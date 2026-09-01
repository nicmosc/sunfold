"""
Generates Sunfold's app icon, splash mark and Android adaptive foreground.

    python3 scripts/generate-icon.py

Writes straight into assets/images/. Requires Pillow (`pip install pillow`).

The knobs worth touching are the constants below: DOME_RX/RY and DOME_CY for how
much of the sun the dome covers and how curved it is, RIM_ALPHA and DOME_BLUR
for how glassy versus foggy its edge reads, HAZE_* for the sun's light diffusing
into it, and TOP_LIGHT_ALPHA for the light from above.

Four things that are easy to get wrong, all learned the hard way:

1. The dome's edge was blurred so heavily it read as fog. Glass has a DEFINED
   boundary — a small blur plus a bright rim highlight along the crest, which is
   what light catching an edge actually looks like.
2. The dome was smaller than the canvas, so its left and right sides faded out
   inside the frame. Visible immediately in the transparent splash asset. It now
   extends well past every edge and is cut off by the frame instead.
3. The sphere had a radial ramp but no directional top light, so it read as
   evenly glossy rather than lit from above.
4. The dome must be near-OPAQUE. At partial alpha the sun's circular outline
   stays visible across it, which reads as a translucent overlay rather than
   something the sun is behind. The warm glow belongs on TOP of the dome.

The field is faintly COOL on purpose: the dome is warm cream, and that small
temperature difference is the only thing making its silhouette readable. On a
pure white field the dome disappears entirely.
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

SS = 3
OUT = 1024

# Faintly cool ground. The dome is warm cream, and that temperature difference
# is what makes its silhouette readable — on pure white the dome vanishes.
FIELD_TOP = (250, 248, 252)
FIELD_BOTTOM = (253, 252, 254)

DOME_COLOR = (255, 240, 222)
HAZE = (255, 205, 156)

SUN_STOPS = [
    (0.00, (253, 219, 138)),
    (0.30, (249, 180, 76)),
    (0.68, (240, 139, 47)),
    (1.00, (222, 105, 37)),
]

# Geometry as fractions of the canvas.
SUN_CX, SUN_CY, SUN_R = 0.50, 0.510, 0.315
# Deliberately larger than the canvas on every axis, so no edge of the dome is
# ever visible inside the frame.
DOME_CX, DOME_CY = 0.50, 1.03
DOME_RX, DOME_RY = 0.598, 0.42
HAZE_CY, HAZE_R = 0.66, 0.255

# The dome is glass, not paint: it is most transparent directly over the sun so
# the sphere genuinely shows through, and closes up toward its edges. The visible
# object behind is what separates glass from a frosted panel.
DOME_ALPHA_OVER_SUN = 70
DOME_ALPHA_EDGE = 214
DOME_SEETHROUGH_R = 0.34

# Frosted glass DIFFUSES what is behind it. Veiling a sharp sphere reads as
# tinted acetate; blurring the backdrop inside the dome is what makes it glass.
DOME_BACKDROP_BLUR = 0.055

DOME_BLUR = 0.0015
RIM_THICKNESS = 0.005
RIM_ALPHA = 150
TOP_LIGHT_ALPHA = 148
TOP_LIGHT_REACH = 0.56


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def ramp(stops, t):
    t = min(1.0, max(0.0, t))
    for i in range(len(stops) - 1):
        t0, c0 = stops[i]
        t1, c1 = stops[i + 1]
        if t0 <= t <= t1:
            span = t1 - t0
            return lerp(c0, c1, 0 if span == 0 else (t - t0) / span)
    return stops[-1][1]


def vertical_field(size):
    strip = Image.new("RGB", (1, size))
    px = strip.load()
    for y in range(size):
        px[0, y] = lerp(FIELD_TOP, FIELD_BOTTOM, y / (size - 1))
    return strip.resize((size, size), Image.BILINEAR)


def circle_mask(d, blur=0.0):
    m = Image.new("L", (d, d), 0)
    ImageDraw.Draw(m).ellipse((0, 0, d - 1, d - 1), fill=255)
    return m.filter(ImageFilter.GaussianBlur(d * blur)) if blur > 0 else m


def sun_sphere(d):
    """Shaded sphere with a directional light from above."""
    img = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    px = img.load()
    r = d / 2
    lx, ly = r - 0.30 * r, r - 0.34 * r
    reach = 1.62 * r

    # Colour EVERY pixel, including outside the circle. Masking a square whose
    # outside is transparent black blends black at the rim — a grey hairline.
    for y in range(d):
        for x in range(d):
            dist = ((x - lx) ** 2 + (y - ly) ** 2) ** 0.5
            px[x, y] = ramp(SUN_STOPS, dist / reach) + (255,)

    # Directional top light: a vertical white wash over the upper cap, gone by
    # the equator. The radial ramp alone gives a highlight but no sense of
    # WHERE the light is; this is what makes it read as lit from above.
    ramp_strip = Image.new("L", (1, d), 0)
    rp = ramp_strip.load()
    limit = max(1, int(d * TOP_LIGHT_REACH))
    for y in range(d):
        t = min(1.0, y / limit)
        rp[0, y] = round(TOP_LIGHT_ALPHA * (1 - t) ** 2)
    light = Image.new("RGBA", (d, d), (255, 255, 255, 0))
    light.putalpha(ramp_strip.resize((d, d), Image.BILINEAR))
    img = Image.alpha_composite(img, light)

    img.putalpha(circle_mask(d))
    return img


def radial_alpha(size, cx, cy, radius, inner, outer, res=320):
    """Low-res radial ramp, upscaled. Smooth ramps survive this exactly."""
    small = Image.new("L", (res, res), outer)
    px = small.load()
    rcx, rcy, rr = cx * res, cy * res, radius * res

    for y in range(res):
        for x in range(res):
            dist = ((x - rcx) ** 2 + (y - rcy) ** 2) ** 0.5
            t = min(1.0, dist / rr) if rr > 0 else 1.0
            px[x, y] = round(inner + (outer - inner) * t)

    return small.resize((size, size), Image.BICUBIC)


def dome_mask(s, dy=0.0):
    m = Image.new("L", (s, s), 0)
    ImageDraw.Draw(m).ellipse(
        (
            s * (DOME_CX - DOME_RX),
            s * (DOME_CY - DOME_RY) + dy,
            s * (DOME_CX + DOME_RX),
            s * (DOME_CY + DOME_RY) + dy,
        ),
        fill=255,
    )
    return m


def build(size, opaque_field):
    s = size * SS

    base = (
        vertical_field(s).convert("RGBA")
        if opaque_field
        else Image.new("RGBA", (s, s), (0, 0, 0, 0))
    )

    d = int(s * SUN_R * 2)
    sphere = sun_sphere(d)
    base.paste(sphere, (int(s * SUN_CX - d / 2), int(s * SUN_CY - d / 2)), sphere)

    shape = dome_mask(s).filter(ImageFilter.GaussianBlur(s * DOME_BLUR))

    # Frosted backdrop: inside the dome, swap in a blurred copy of everything
    # behind it. This is the actual glass effect — the veil and haze that follow
    # only tint and soften it.
    base = Image.composite(
        base.filter(ImageFilter.GaussianBlur(s * DOME_BACKDROP_BLUR)), base, shape
    )

    # Dome alpha is a radial ramp centred on the SUN, not a flat value: thinnest
    # where the sphere is behind it, closing up toward the dome's edges.
    dome = Image.new("RGBA", (s, s), DOME_COLOR + (0,))
    dome.putalpha(
        Image.composite(
            radial_alpha(
                s,
                SUN_CX,
                SUN_CY,
                DOME_SEETHROUGH_R,
                inner=DOME_ALPHA_OVER_SUN,
                outer=DOME_ALPHA_EDGE,
            ),
            Image.new("L", (s, s), 0),
            shape,
        )
    )
    base = Image.alpha_composite(base, dome)

    # Warm haze on top of the dome, clipped to it.
    haze_alpha = Image.composite(
        radial_alpha(s, DOME_CX, HAZE_CY, HAZE_R, inner=120, outer=0),
        Image.new("L", (s, s), 0),
        shape,
    )
    haze = Image.new("RGBA", (s, s), HAZE + (0,))
    haze.putalpha(haze_alpha)
    base = Image.alpha_composite(base, haze)

    # Rim: the sliver between the dome and a copy nudged down. Light catching a
    # glass edge, which is what separates glass from fog.
    crisp = dome_mask(s)
    band = ImageChops.subtract(crisp, dome_mask(s, dy=s * RIM_THICKNESS))
    band = band.filter(ImageFilter.GaussianBlur(s * DOME_BLUR * 0.8))
    band = band.point(lambda v: round(v * RIM_ALPHA / 255))
    rim = Image.new("RGBA", (s, s), (255, 255, 255, 0))
    rim.putalpha(band)
    base = Image.alpha_composite(base, rim)

    return base.resize((size, size), Image.LANCZOS)


# Resolved from this file so the script survives the repo being moved or renamed.
ROOT = Path(__file__).resolve().parent.parent / "assets" / "images"

icon = build(OUT, opaque_field=True).convert("RGB")
icon.save(f"{ROOT}/icon.png")
print("icon.png", icon.size, icon.mode)

splash = build(512, opaque_field=False)
splash.save(f"{ROOT}/splash-icon.png")
print("splash-icon.png", splash.size, splash.mode)

fg = build(1024, opaque_field=False)
fg.save(f"{ROOT}/android-icon-foreground.png")
print("android-icon-foreground.png", fg.size, fg.mode)

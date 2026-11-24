"""Builds the site's logo images from the two cut-out pieces in this folder.

src/lib/logo.webp       figure + lettering side by side (homepage header)
src/lib/logo-text.webp  lettering alone (header on every other page)
src/lib/dobby.webp      figure alone (bottom of each recipe)


logo-figure.png  Dobby, cut from the second generated logo
logo-text.png    the lettering, cut from the first one
Change GAP / TEXT_SCALE / TEXT_DY and run `python design/compose.py`.
"""
import sys
from pathlib import Path
from PIL import Image

HERE = Path(__file__).parent
GAP = 14          # px between the pan and the lettering
TEXT_SCALE = 1.0  # lettering size relative to the figure
TEXT_DY = 0       # move the lettering down (+) or up (-) from centred
WIDTH = 920       # width of the exported logo
TEXT_WIDTH = 600  # width of the lettering-only image
FIG_WIDTH = 300   # width of the figure-only image

fig = Image.open(HERE / 'logo-figure.png')
txt = Image.open(HERE / 'logo-text.png')
if TEXT_SCALE != 1:
    txt = txt.resize((round(txt.width * TEXT_SCALE), round(txt.height * TEXT_SCALE)), Image.LANCZOS)

h = max(fig.height, txt.height)
canvas = Image.new('RGBA', (fig.width + GAP + txt.width, h), (0, 0, 0, 0))
canvas.alpha_composite(fig, (0, (h - fig.height) // 2))
canvas.alpha_composite(txt, (fig.width + GAP, (h - txt.height) // 2 + TEXT_DY))
canvas = canvas.resize((WIDTH, round(h * WIDTH / canvas.width)), Image.LANCZOS)

LIB = HERE.parent / 'src' / 'lib'

def save(img, name, width=None):
    if width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    img.save(LIB / name, 'WEBP', quality=86, method=6)
    print(name, img.size)

save(canvas, 'logo.webp')
save(Image.open(HERE / 'logo-text.png'), 'logo-text.webp', TEXT_WIDTH)
save(fig, 'dobby.webp', FIG_WIDTH)
if len(sys.argv) > 1:  # optional: preview on the site's beige
    bg = Image.new('RGBA', canvas.size, (242, 234, 216, 255))
    bg.alpha_composite(canvas)
    bg.convert('RGB').save(sys.argv[1])

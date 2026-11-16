# Génère le CSS du coffre commun en 3D (couvercle bombé : planches en arc, joues, gemme) dans public/css/style.css.
# Usage : python scripts/coffre.py (depuis la racine du projet)
import math, os, urllib.parse

W, D, H = 1.1, 0.9, 0.6      # corps (en --s)
R = D / 2                    # demi-profondeur
A, RY = 0.07, 0.30           # lèvre du couvercle, hauteur de l'arc
N = 8                        # planches du couvercle
CAPH = A + RY

def S(v):
    return f"calc(var(--s) * {v:.4f})"

def P(t):
    return (R * math.cos(t), -A - RY * math.sin(t))   # (z, y)

def svg(s):
    return "url(\"data:image/svg+xml," + urllib.parse.quote(s, safe="=:/ '") + "\")"

# Veinures du bois : bruit étiré dans le sens des planches ; fer martelé : bruit fin
GRAIN = svg("<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.004 0.22' numOctaves='3' seed='7'/><feColorMatrix values='0 0 0 0 0.08  0 0 0 0 0.04  0 0 0 0 0.01  0 0 0 2.0 -0.6'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>")
HAMMER = svg("<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.09' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 0.6  0 0 0 0 0.6  0 0 0 0 0.66  0 0 0 0.38 -0.1'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>")

STUD = "radial-gradient(circle at 38% 34%, #d9d9e2 0 7%, #7d7d8a 18%, #3a3a44 46%, #15151a 62%, transparent 66%)"

css = []
o = css.append
o(f"""/* --- Le coffre commun en 3D (CSS), façon dark fantasy : planches de bois sombre veinées et biseautées,
   gros cerclages de fer martelé cloutés aux quatre coins, couvercle bombé (8 planches en arc) sur charnière,
   serrure en losange, gemme verte (la couleur du coffre commun). Géométrie calculée par un petit script :
   corps {W} × {D} × {H} --s, couvercle en arc de {CAPH:.2f} --s.
   --s : taille ; --open : couvercle entrouvert (angle) ; --leak : lumière qui fuit (0 à 1) ; --c : sa couleur. */
@property --c {{ syntax: '<color>'; inherits: true; initial-value: #2fe38a; }}
@property --leak {{ syntax: '<number>'; inherits: true; initial-value: 0; }}
@property --open {{ syntax: '<angle>'; inherits: true; initial-value: 0deg; }}
.cube {{
  --s: 150px; --open: 0deg; --leak: 0; --edge: #070403;
  --pl: calc(var(--s) * 0.1); /* largeur d'une planche */
  --grain: {GRAIN};
  --hammer: {HAMMER};
  position: relative; width: calc(var(--s) * 1.95); height: calc(var(--s) * 1.7); margin: 0 auto; perspective: 1000px; perspective-origin: 50% 12%;
  transition: --leak 0.35s ease-out, --open 0.32s cubic-bezier(0.3, 1.9, 0.5, 1);
}}
.cube::before {{ /* halo derrière le coffre, de plus en plus fort quand la lumière fuit */
  content: ''; position: absolute; inset: -25%; pointer-events: none; border-radius: 50%;
  background: radial-gradient(circle at 50% 52%, color-mix(in srgb, var(--c) calc(var(--leak) * 70%), transparent), transparent 56%);
}}
.cube-shadow {{ position: absolute; left: 50%; bottom: 7%; width: 80%; height: 16%; transform: translateX(-50%); border-radius: 50%; background: radial-gradient(closest-side, rgba(0, 0, 0, 0.75), transparent); }}
.cube-rot {{ position: absolute; left: 50%; top: 50%; width: 0; height: 0; transform-style: preserve-3d; transform: rotateX(-22deg) rotateY(-30deg); animation: cube-idle 8s ease-in-out infinite; }}
@keyframes cube-idle {{ 0%, 100% {{ transform: rotateX(-22deg) rotateY(-32deg); }} 50% {{ transform: rotateX(-16deg) rotateY(32deg); }} }}
.cube.idle .cube-rot {{ animation-duration: 10s; }}
.cb-body, .cb-lid {{ position: absolute; left: 0; top: 0; transform-style: preserve-3d; }}
/* Charnière à l'arrière du couvercle */
.cb-lid {{ transform: translateZ({S(-R)}) rotateX(var(--open)) translateZ({S(R)}); }}
.cube .f {{ position: absolute; left: 0; top: 0; display: block; box-sizing: border-box; overflow: hidden; --sh: 0; }}
.cube .f::after {{ content: ''; position: absolute; inset: 0; pointer-events: none; opacity: var(--leak); mix-blend-mode: screen; z-index: 3; }}

/* Bois : planches biseautées (arête claire en haut, joint sombre en bas), veinures, ombre de la face */
.cube .front, .cube .back, .cube .left, .cube .right, .cube .lf, .cube .lb, .cube .cap-wood {{
  border: 2px solid var(--edge);
  background:
    linear-gradient(rgba(0, 0, 0, var(--sh)), rgba(0, 0, 0, var(--sh))),
    var(--grain) 0 0 / 320px 320px,
    repeating-linear-gradient(180deg, #6a4429 0 1.5px, #4a2f1b 1.5px, #3c2514 calc(var(--pl) * 0.55), #2c1a0c calc(var(--pl) - 4px), #120a04 calc(var(--pl) - 2px), #050302 var(--pl));
  box-shadow: inset 0 -8px 14px rgba(0, 0, 0, 0.55), inset 0 4px 6px rgba(255, 200, 140, 0.06);
}}
.cube .front::after, .cube .back::after, .cube .left::after, .cube .right::after {{ background: linear-gradient(180deg, var(--c), transparent 50%); }}
/* Chaque planche du couvercle : une seule planche bombée */
.cube .lid {{
  border: 1px solid var(--edge); border-left-width: 2px; border-right-width: 2px;
  background:
    linear-gradient(rgba(0, 0, 0, var(--sh)), rgba(0, 0, 0, var(--sh))),
    var(--grain) 0 var(--gy, 0) / 320px 320px,
    linear-gradient(180deg, #0d0703 0, #5e3d24 12%, #472c1a 35%, #352012 75%, #140b05 100%);
}}
/* Cerclages de fer martelé aux deux extrémités, avec un relief (ombre portée sur le bois) */
.cube .band {{
  position: absolute; top: -2px; bottom: -2px; width: 15%; z-index: 1;
  background: var(--hammer) 0 0 / 120px 120px, linear-gradient(90deg, #08080a 0, #4c4c56 8%, #34343d 22%, #23232a 62%, #2d2d36 86%, #08080a 100%);
  box-shadow: 0 0 0 1px #050506, 3px 0 5px rgba(0, 0, 0, 0.7), -3px 0 5px rgba(0, 0, 0, 0.7);
}}
.cube .band.l {{ left: 0; }}
.cube .band.r {{ right: 0; transform: scaleX(-1); }}
/* Clous ronds sur les cerclages du corps */
.cube .front .band, .cube .back .band, .cube .left .band, .cube .right .band {{
  background:
    {STUD} 50% 20% / calc(var(--s) * 0.085) calc(var(--s) * 0.085) no-repeat,
    {STUD} 50% 55% / calc(var(--s) * 0.085) calc(var(--s) * 0.085) no-repeat,
    {STUD} 50% 90% / calc(var(--s) * 0.085) calc(var(--s) * 0.085) no-repeat,
    var(--hammer) 0 0 / 120px 120px, linear-gradient(90deg, #08080a 0, #4c4c56 8%, #34343d 22%, #23232a 62%, #2d2d36 86%, #08080a 100%);
}}
/* Bande de fer en haut du corps (sous le couvercle) */
.cube .rim {{
  position: absolute; left: 0; right: 0; top: 0; height: 13%; z-index: 2;
  background: var(--hammer) 0 0 / 120px 120px, linear-gradient(180deg, #4c4c56, #30303a 40%, #1e1e25 80%, #08080a);
  box-shadow: 0 3px 5px rgba(0, 0, 0, 0.7);
}}
.cube .front, .cube .back {{ width: {S(W)}; height: {S(H)}; }}
.cube .left, .cube .right {{ width: {S(D)}; height: {S(H)}; }}
.cube .front {{ transform: translate(-50%, -50%) translate3d(0, {S(H/2)}, {S(R)}); }}
.cube .back {{ --sh: 0.35; transform: translate(-50%, -50%) translate3d(0, {S(H/2)}, {S(-R)}) rotateY(180deg); }}
.cube .right {{ --sh: 0.3; transform: translate(-50%, -50%) translate3d({S(W/2)}, {S(H/2)}, 0) rotateY(90deg); }}
.cube .left {{ --sh: 0.42; transform: translate(-50%, -50%) translate3d({S(-W/2)}, {S(H/2)}, 0) rotateY(-90deg); }}
.cube .bottom {{ width: {S(W)}; height: {S(D)}; background: #0b0603; transform: translate(-50%, -50%) translate3d(0, {S(H)}, 0) rotateX(90deg); }}
.cube .inner {{ /* le fond lumineux, juste sous la fente : on le voit quand le couvercle s'ouvre */
  width: calc({S(W)} - 6px); height: calc({S(D)} - 6px);
  background: radial-gradient(ellipse, #fff 0, color-mix(in srgb, var(--c) 70%, #fff) 28%, var(--c) 58%, color-mix(in srgb, var(--c) 40%, #000));
  transform: translate(-50%, -50%) translate3d(0, {S(0.05)}, 0) rotateX(90deg);
}}
/* Serrure : plaque de fer en losange, clous et trou de serrure */
.cube .lock {{
  position: absolute; left: 50%; top: 4%; width: {S(0.22)}; height: {S(0.22)}; z-index: 2; transform: translateX(-50%) rotate(45deg);
  background: {STUD} 8% 8% / 22% 22% no-repeat, {STUD} 92% 92% / 22% 22% no-repeat, var(--hammer) 0 0 / 120px 120px, linear-gradient(135deg, #6a6a76, #3a3a45 45%, #1c1c23);
  border: 2px solid #050506; box-shadow: 3px 4px 7px rgba(0, 0, 0, 0.75), inset 1px 1px 0 rgba(255, 255, 255, 0.2);
}}
.cube .keyhole {{
  position: absolute; left: 50%; top: 50%; width: 46%; height: 46%; transform: translate(-50%, -50%) rotate(-45deg); border-radius: 50%;
  background: radial-gradient(circle at 50% 36%, #050304 0 15%, transparent 16%), linear-gradient(90deg, transparent 43%, #050304 43% 57%, transparent 57%) 0 70% / 100% 40% no-repeat, radial-gradient(circle, #2a2a32 0 60%, #0b0b0e 62% 70%, #55555f 72%);
}}

/* Couvercle */
.cube .lbot {{ width: {S(W)}; height: {S(D)}; background: #140b05; transform: translate(-50%, -50%) rotateX(90deg); }}
.cube .lf, .cube .lb {{ width: {S(W)}; height: {S(A)}; }}
.cube .lf {{ transform: translate(-50%, -50%) translate3d(0, {S(-A/2)}, {S(R)}); }}
.cube .lb {{ --sh: 0.35; transform: translate(-50%, -50%) translate3d(0, {S(-A/2)}, {S(-R)}) rotateY(180deg); }}
.cube .lf::after, .cube .lb::after, .cube .lid::after {{ background: linear-gradient(0deg, var(--c), transparent 90%); }}
.cube .lid .band {{ box-shadow: 0 0 0 1px #050506, 3px 0 4px rgba(0, 0, 0, 0.6), -3px 0 4px rgba(0, 0, 0, 0.6); }}""")

# Les planches du couvercle, en arc
for i in range(N):
    t1, t2 = math.pi * i / N, math.pi * (i + 1) / N
    (z1, y1), (z2, y2) = P(t1), P(t2)
    zc, yc = (z1 + z2) / 2, (y1 + y2) / 2
    ln = math.hypot(z2 - z1, y2 - y1)
    phi = math.degrees(math.atan2(-(z2 - z1), -(y2 - y1)))
    # Lumière venant d'en haut et de face : le dessus plus clair, l'arrière plus sombre
    sh = max(0, min(0.45, 0.12 + 0.05 * (i - 2) ** 1)) if i >= 3 else max(0, 0.1 - 0.05 * i)
    o(f".cube .lid{i} {{ --sh: {sh:.2f}; --gy: {i * 37}px; width: {S(W)}; height: calc({S(ln)} + 1px); transform: translate(-50%, -50%) translate3d(0, {S(yc)}, {S(zc)}) rotateX({phi:.2f}deg); }}")
# Clous sur les cerclages du couvercle, une planche sur deux
o(f""".cube .lid1 .band, .cube .lid3 .band, .cube .lid5 .band, .cube .lid7 .band, .cube .lf .band {{
  background: {STUD} 50% 50% / calc(var(--s) * 0.065) calc(var(--s) * 0.065) no-repeat, var(--hammer) 0 0 / 120px 120px, linear-gradient(90deg, #08080a 0, #4c4c56 8%, #34343d 22%, #23232a 62%, #2d2d36 86%, #08080a 100%);
}}""")

# Joues : la coupe du couvercle bombé, cerclée de fer
pts = ["0 100%"]
for k in range(N, -1, -1):
    z, y = P(math.pi * k / N)
    pts.append(f"{(z + R) / D * 100:.2f}% {(y + CAPH) / CAPH * 100:.2f}%")
pts.append("100% 100%")
poly = "polygon(" + ", ".join(pts) + ")"
o(f""".cube .ll, .cube .lr {{
  width: {S(D)}; height: {S(CAPH)}; clip-path: {poly};
  background: var(--hammer) 0 0 / 120px 120px, linear-gradient(180deg, #55555f, #2c2c35 60%, #15151a);
}}
.cube .cap-wood {{ position: absolute; inset: 9% 9% 0; clip-path: {poly}; border: 0; box-shadow: none; }}
.cube .lr {{ --sh: 0.28; transform: translate(-50%, -50%) translate3d({S(W/2)}, {S(-CAPH/2)}, 0) rotateY(90deg); }}
.cube .ll {{ --sh: 0.42; transform: translate(-50%, -50%) translate3d({S(-W/2)}, {S(-CAPH/2)}, 0) rotateY(-90deg); }}
.cube .ll .cap-wood {{ --sh: 0.42; }}
.cube .lr .cap-wood {{ --sh: 0.28; }}""")

# Gemme : posée sur le devant du couvercle (vers 55°), sertie de fer, un peu en saillie
tg = math.radians(52)
zg, yg = P(tg)
nz, ny = math.cos(tg) / R, math.sin(tg) / RY        # normale de l'ellipse (z, -y)
nl = math.hypot(nz, ny)
nz, ny = nz / nl, ny / nl
off = 0.012
phig = math.degrees(math.atan2(ny, nz))   # inclinaison de la face (0 = verticale)
phig = 90 - math.degrees(math.atan2(ny, nz))
o(f""".cube .gem-set {{
  position: absolute; left: 0; top: 0; width: {S(0.2)}; height: {S(0.2)}; border-radius: 50%; z-index: 4;
  transform: translate(-50%, -50%) translate3d(0, {S(yg - ny * off)}, {S(zg + nz * off)}) rotateX({90 - math.degrees(math.atan2(nz, ny)):.2f}deg);
  background: radial-gradient(circle, #15151a 0 56%, #6a6a76 58% 63%, #2a2a33 65% 80%, #050506 82%);
  box-shadow: 0 0 calc(var(--s) * 0.08) rgba(47, 227, 138, 0.55);
  animation: gem-glow 2.6s ease-in-out infinite;
}}
.cube .gem {{
  position: absolute; inset: 16%; clip-path: polygon(50% 0, 100% 38%, 80% 100%, 20% 100%, 0 38%);
  background:
    linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.8) 34%, transparent 42%),
    conic-gradient(from 200deg at 50% 45%, #0b7a48, #3cf2a3, #b8ffde, #2fe38a, #08603a, #1fbf74, #0b7a48);
  filter: brightness(calc(1 + var(--leak) * 0.6));
}}
@keyframes gem-glow {{ 50% {{ box-shadow: 0 0 calc(var(--s) * 0.2) rgba(60, 242, 163, 0.85); }} }}
@media (prefers-reduced-motion: reduce) {{ .cube-rot, .cube .gem-set {{ animation: none; }} }}
""")

out = "\n".join(css) + "\n"
p = 'public/css/style.css'
s = open(p, encoding='utf-8', newline='').read().replace('\r\n', '\n')
i = s.index('/* --- Le coffre commun en 3D')
j = s.index('/* Coffre de la page')
s = s[:i] + out + "\n" + s[j:]
open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', '\r\n'))
print('ok', len(out))

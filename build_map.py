"""Build compact dot-density map data for the Movento BYD proposal.

Inputs: OSM extracts in osm/, Idescat figures (hard-coded below, fetched 2026-09-30).
Output: mapdata.js  (window.MAPDATA = {...})
"""
import json, math, random, base64, struct, re
from shapely.geometry import Polygon, MultiPolygon, LineString, Point, box, shape
from shapely.ops import linemerge, polygonize, unary_union, split
from shapely.prepared import prep

random.seed(7)
S, W, N, E = 41.400, 2.180, 41.510, 2.400
LAT0 = (S + N) / 2
KX = 111320 * math.cos(math.radians(LAT0))
KY = 110574
WIDTH_M = (E - W) * KX
HEIGHT_M = (N - S) * KY
Q = 2  # half-metre units

def proj(lon, lat):
    return ((lon - W) * KX, (N - lat) * KY)

def q(x, y):
    return (max(0, min(65535, round(x * Q))), max(0, min(65535, round(y * Q))))

BBOX = box(0, 0, WIDTH_M, HEIGHT_M)

# ---------- Idescat 2025 (population) / 2023 RFDB / 2024 turismos ----------
MUNI = {
    # name: (pop2025, chinese2025, chinese_yoy_abs, rfdb_hab_2023, rfdb_index, turismos_2024)
    'Badalona': (230642, 4723, 234, 19114, 91.9, 77081),
    'Santa Coloma de Gramenet': (123250, 4818, 135, 16649, 80.1, 34470),
    'Sant Adrià de Besòs': (38980, 903, 19, 17283, 83.1, 12322),
    'Montgat': (12835, 276, 4, 22061, 106.1, 6126),
    'el Masnou': (24727, 191, -7, 23920, 115.1, 11161),
    'Premià de Mar': (29348, 165, 8, 20343, 97.9, 11996),
    'Premià de Dalt': (10601, 68, -2, 26364, 126.8, 5202),
    'Tiana': (9362, 45, 1, 28136, 135.3, 4414),
    'Teià': (6894, 83, 10, 28108, 135.2, 3455),
    'Alella': (10251, 155, 51, 35425, 170.4, 5193),
    'Vilassar de Mar': (21234, 36, 0, 25085, 120.7, 9638),
    'Sant Fost de Campsentelles': (9400, 31, 5, 21394, 102.9, 5213),
    'Montcada i Reixac': (37446, 212, 22, 18591, 89.4, 17869),
    'Barcelona': (1713247, 22333, 1507, 25898, 124.6, 487185),
}
STUDY = {'Badalona', 'Santa Coloma de Gramenet', 'Sant Adrià de Besòs', 'Montgat', 'el Masnou',
         'Premià de Mar', 'Premià de Dalt', 'Tiana', 'Teià', 'Alella', 'Vilassar de Mar'}

# ---------- helpers ----------
def ring_from_geom(geom):
    return [proj(p['lon'], p['lat']) for p in geom]

def assemble_relation(rel):
    """Assemble outer/inner rings of an OSM multipolygon relation (out geom)."""
    outers, inners = [], []
    for m in rel.get('members', []):
        if m.get('type') != 'way' or 'geometry' not in m:
            continue
        line = LineString(ring_from_geom(m['geometry']))
        (outers if m.get('role') != 'inner' else inners).append(line)
    polys = list(polygonize(linemerge(unary_union(outers)))) if outers else []
    holes = list(polygonize(linemerge(unary_union(inners)))) if inners else []
    geom = unary_union(polys)
    for h in holes:
        geom = geom.difference(h)
    return geom

def encode_u16(values):
    return base64.b64encode(struct.pack('<%dH' % len(values), *values)).decode()

def encode_lines(lines):
    """Flatten lines into [n, x0,y0, x1,y1...] uint16 stream."""
    out = []
    for coords in lines:
        pts = [q(x, y) for x, y in coords]
        # drop consecutive duplicates
        dedup = [pts[0]]
        for p in pts[1:]:
            if p != dedup[-1]:
                dedup.append(p)
        if len(dedup) < 2:
            continue
        out.append(len(dedup))
        for p in dedup:
            out.extend(p)
    return encode_u16(out)

def geom_lines(g):
    if g.is_empty:
        return []
    if g.geom_type == 'LineString':
        return [list(g.coords)]
    if g.geom_type in ('MultiLineString', 'GeometryCollection'):
        r = []
        for gg in g.geoms:
            r += geom_lines(gg)
        return r
    return []

def poly_rings(g):
    if g.is_empty:
        return []
    if g.geom_type == 'Polygon':
        return [list(g.exterior.coords)] + [list(i.coords) for i in g.interiors]
    if g.geom_type in ('MultiPolygon', 'GeometryCollection'):
        r = []
        for gg in g.geoms:
            r += poly_rings(gg)
        return r
    return []

# ---------- sea / land ----------
land_el = json.load(open('osm/land.json'))['elements']
coast = [LineString(ring_from_geom(e['geometry'])) for e in land_el
         if e['type'] == 'way' and e.get('tags', {}).get('natural') == 'coastline']
coast_line = linemerge(unary_union(coast))
parts = sorted(getattr(coast_line, 'geoms', [coast_line]), key=lambda g: -g.length)
main_coast = parts[0]
pieces = split(BBOX, main_coast)
sea_pt = Point(*proj(2.33, 41.42))
sea = None
for p in pieces.geoms:
    if p.contains(sea_pt):
        sea = p
for ring in parts[1:]:
    if ring.is_ring:
        sea = sea.difference(Polygon(ring.coords))
sea = sea.intersection(BBOX).simplify(2)
land = BBOX.difference(sea)
land_prep = prep(land)
print('sea area km2', sea.area / 1e6)

# ---------- municipalities ----------
admin = json.load(open('osm/admin.json'))['elements']
munis = {}
for r in admin:
    name = r['tags'].get('name')
    g = assemble_relation(r)
    if g.is_empty:
        continue
    g = g.buffer(0)
    full = g
    clipped = g.intersection(land)
    munis[name] = dict(full=full, geom=clipped, prep=prep(full),
                       inside=(full.intersection(BBOX).area / full.area) if full.area else 0)
    print(f"{name:32s} inside={munis[name]['inside']:.2f} area={full.area/1e6:.1f}km2")

# ---------- census districts with Chinese counts (Idescat 2025 by district; INE 2025 sections) ----------
from shapely.geometry import shape as _shape
DGEO = json.load(open('districts_geo.json'))
DCN = json.load(open('districts_cn.json'))
ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X']
MCODE = {'08015': ('080155', 'Badalona'), '08245': ('082457', 'Santa Coloma de Gramenet')}
districts = []
for key, gj in DGEO.items():
    mc, dc = key.split('-')
    idc, mname = MCODE[mc]
    rn = ROMAN[int(dc) - 1]
    foreign, cn = DCN[idc]['d']['Distrito ' + rn]
    g = _shape(gj)
    g = Polygon() if g.is_empty else g
    from shapely.ops import transform as _tf
    gp = _tf(lambda x, y, z=None: proj(x, y), g).buffer(0)
    districts.append(dict(muni=mname, roman=rn, cn=cn, foreign=foreign, geom=gp, prep=prep(gp), w=0.0))

# ---------- buildings -> dots ----------
bld = json.load(open('osm/buildings.json'))['elements']
industrial_polys = []
for e in land_el:
    t = e.get('tags', {})
    if t.get('landuse') in ('industrial', 'commercial', 'retail'):
        if e['type'] == 'way':
            try:
                industrial_polys.append(Polygon(ring_from_geom(e['geometry'])).buffer(0))
            except Exception:
                pass
        else:
            try:
                industrial_polys.append(assemble_relation(e).buffer(0))
            except Exception:
                pass
ind_union = unary_union(industrial_polys)
ind_prep = prep(ind_union)

RES_TYPES = {'residential': 4, 'apartments': 5, 'yes': 3, 'house': 2, 'detached': 2,
             'semidetached_house': 2, 'terrace': 2, 'dormitory': 4}
BIZ_TYPES = {'industrial', 'warehouse', 'yes', 'retail', 'commercial'}

res = []   # (x, y, w, h, weight, muni)
biz = []   # candidates for Badalona Sud company dots
BSUD = box(*proj(2.2195, 41.4425), *proj(2.2425, 41.4262))  # minx,miny,maxx,maxy in projected space
BSUD = box(min(BSUD.bounds[0], BSUD.bounds[2]), min(BSUD.bounds[1], BSUD.bounds[3]),
           max(BSUD.bounds[0], BSUD.bounds[2]), max(BSUD.bounds[1], BSUD.bounds[3]))

def muni_of(pt):
    for n, m in munis.items():
        if m['prep'].contains(pt):
            return n
    return None

for e in bld:
    b = e.get('bounds')
    if not b:
        continue
    t = e.get('tags', {})
    btype = t.get('building')
    x0, y0 = proj(b['minlon'], b['maxlat'])
    x1, y1 = proj(b['maxlon'], b['minlat'])
    w, h = x1 - x0, y1 - y0
    area = w * h * 0.72
    if area < 25:
        continue
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    pt = Point(cx, cy)
    in_ind = ind_prep.contains(pt)
    if btype in RES_TYPES and not (btype == 'yes' and in_ind):
        lv = t.get('building:levels')
        try:
            levels = max(1, min(20, float(re.findall(r'[\d.]+', lv)[0]))) if lv else RES_TYPES[btype]
        except Exception:
            levels = RES_TYPES[btype]
        mn = muni_of(pt)
        if mn:
            di = None
            if mn in ('Badalona', 'Santa Coloma de Gramenet'):
                for i, d in enumerate(districts):
                    if d['muni'] == mn and d['prep'].contains(pt):
                        di = i
                        break
            res.append((x0, y0, w, h, area * levels, mn, di))
            if di is not None:
                districts[di]['w'] += area * levels
    if btype in BIZ_TYPES and BSUD.contains(pt) and (in_ind or btype != 'yes'):
        mn = muni_of(pt)
        if mn == 'Badalona':
            biz.append((x0, y0, w, h, area))

print('residential buildings', len(res), 'biz candidates', len(biz))

wsum = {}
for r in res:
    wsum[r[5]] = wsum.get(r[5], 0) + r[4]
factors = {}
for n, (pop, *_rest) in MUNI.items():
    if n in wsum and munis.get(n, {}).get('inside', 0) > 0.97:
        factors[n] = pop / wsum[n]
med = sorted(factors.values())[len(factors) // 2]
print('factors', {k: round(v, 4) for k, v in factors.items()}, 'median', med)

SCALE_ALL = 10   # one grey dot = 10 residents
SCALE_CN = 3     # one red dot = 3 Chinese-origin residents

def stoch(v):
    n = int(v)
    return n + (1 if random.random() < v - n else 0)

def rand_in(x0, y0, w, h):
    return (x0 + w * (0.1 + 0.8 * random.random()), y0 + h * (0.1 + 0.8 * random.random()))

dots = {'res': [], 'ctx': [], 'cn': [], 'biz': []}
muni_pop_in_view = {}
for x0, y0, w, h, wt, mn, di in res:
    f = factors.get(mn, med)
    people = wt * f
    study = mn in STUDY
    k = 'res' if study else 'ctx'
    for _ in range(stoch(people / SCALE_ALL)):
        x, y = rand_in(x0, y0, w, h)
        if land_prep.contains(Point(x, y)) or True:
            dots[k].extend(q(x, y))
    if mn in MUNI:
        if di is not None and districts[di]['w'] > 0:
            n_cn = districts[di]['cn'] * wt / districts[di]['w']
        else:
            n_cn = people * MUNI[mn][1] / MUNI[mn][0]
        for _ in range(stoch(n_cn / SCALE_CN)):
            x, y = rand_in(x0, y0, w, h)
            dots['cn'].extend(q(x, y))
    muni_pop_in_view[mn] = muni_pop_in_view.get(mn, 0) + people

# 300+ Chinese companies in Polígon Badalona Sud (Ajuntament de Badalona, 2026)
tot = sum(b[4] for b in biz)
acc = []
for i in range(300):
    r = random.random() * tot
    s = 0
    for bb in biz:
        s += bb[4]
        if s >= r:
            x, y = rand_in(*bb[:4])
            acc.extend(q(x, y))
            break
dots['biz'] = acc
print({k: len(v) // 2 for k, v in dots.items()})

# ---------- roads ----------
roads = json.load(open('osm/roads.json'))['elements']
major, minor = [], []
MAJOR = {'motorway', 'trunk', 'primary', 'motorway_link', 'trunk_link', 'primary_link'}
for e in roads:
    ls = LineString(ring_from_geom(e['geometry']))
    ls = ls.simplify(2.5).intersection(BBOX)
    (major if e['tags']['highway'] in MAJOR else minor).extend(geom_lines(ls))

# ---------- vegetation / industrial fill ----------
green = []
for e in land_el:
    t = e.get('tags', {})
    kind = t.get('natural') or t.get('landuse') or t.get('leisure')
    if e['type'] == 'way' and kind in ('wood', 'scrub', 'forest', 'park', 'meadow', 'grass'):
        try:
            p = Polygon(ring_from_geom(e['geometry'])).buffer(0).simplify(4)
            if p.area > 800:
                green.append(p.intersection(BBOX))
        except Exception:
            pass
green_u = unary_union(green).simplify(4)
ind_bsud = unary_union([p for p in industrial_polys if p.intersects(BSUD)]).intersection(munis['Badalona']['geom'])
river = [LineString(ring_from_geom(e['geometry'])).intersection(BBOX) for e in land_el
         if e['type'] == 'way' and e.get('tags', {}).get('waterway') == 'river']

# ---------- municipality outputs ----------
DEALER = proj(2.25205, 41.45940)
mout = []
for n, m in munis.items():
    g = m['geom'].intersection(BBOX).simplify(6)
    if g.is_empty or g.area < 1e5:
        continue
    c = m['geom'].representative_point()
    # label point: centroid of visible part, but keep inside
    vis = g
    lp = vis.representative_point()
    if n == 'Badalona':
        lp = Point(*proj(2.2385, 41.4505))
    dist = math.hypot(c.x - DEALER[0], c.y - DEALER[1]) / 1000
    stats = MUNI.get(n)
    mout.append(dict(
        name=n, study=n in STUDY,
        rings=[encode_lines([r]) for r in poly_rings(g)],
        label=q(lp.x, lp.y), dist=round(dist, 1),
        stats=None if not stats else dict(pop=stats[0], cn=stats[1], cnYoy=stats[2], rfdb=stats[3],
                                          rfdbIdx=stats[4], cars=stats[5]),
    ))

data = dict(
    w=round(WIDTH_M), h=round(HEIGHT_M), q=Q,
    bbox=[W, S, E, N],
    dealer=q(*DEALER),
    bsud=encode_lines(poly_rings(ind_bsud.simplify(3))),
    sea=encode_lines(poly_rings(sea)),
    green=encode_lines(poly_rings(green_u)),
    coast=encode_lines(geom_lines(coast_line.intersection(BBOX).simplify(2))),
    river=encode_lines(sum([geom_lines(r.simplify(3)) for r in river], [])),
    major=encode_lines(major), minor=encode_lines(minor),
    dots={k: encode_u16(v) for k, v in dots.items()},
    scale=dict(all=SCALE_ALL, cn=SCALE_CN),
    munis=mout,
    districts=[dict(muni=d['muni'], roman=d['roman'], cn=d['cn'], foreign=d['foreign'],
                    rings=[encode_lines([r]) for r in poly_rings(d['geom'].intersection(BBOX).simplify(5))],
                    label=q(d['geom'].representative_point().x, d['geom'].representative_point().y)) for d in districts],
)
s = 'window.MAPDATA=' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';'
open('mapdata.js', 'w').write(s)
print('mapdata.js bytes', len(s))

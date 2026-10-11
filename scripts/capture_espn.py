#!/usr/bin/env python3
"""Records real answers of the ESPN API as fixtures in tests/fixtures/espn/, reduced to the fields the app reads.

  python3 scripts/capture_espn.py history <athlete id> [fights]   the fights an athlete has had: the event log, and the
                                                                  competition and the status of the latest ones (3 by default)
  python3 scripts/capture_espn.py status <event id> <competition id> <name>   one status, saved as status_<name>.json

The fixtures are never written by hand: a field only gets into one because the API sent it. The script says who it is
(the same agent and origin as tests/contract_live.py) and does not pass for a browser. From a machine that cannot reach
ESPN, run it through the "ESPN contract" workflow: `gh workflow run espn-contract.yml --ref <branch> -f capture="history <id>"`,
which commits what was captured to that branch.
"""
import json, pathlib, sys, urllib.error, urllib.request

OUT = pathlib.Path(__file__).resolve().parent.parent / 'tests' / 'fixtures' / 'espn'
CORE = 'https://sports.core.api.espn.com/v2/sports/mma'
ORIGIN = 'https://oito-lados.vercel.app'
AGENT = 'oito-lados-contract-check/1.0 (+https://github.com/lucasmagalhaees/oito-lados)'

def get(url):
    req = urllib.request.Request(url.replace('http://', 'https://', 1), headers={'Origin': ORIGIN, 'User-Agent': AGENT, 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode('utf-8'))

def pick(o, keys):
    """The named keys of an object, the ones that are there; nothing is made up for the ones that are not."""
    return {k: o[k] for k in keys if isinstance(o, dict) and k in o}

def ref(o):
    return pick(o or {}, ['$ref'])

def small_status(s):
    out = pick(s, ['clock', 'displayClock', 'period'])
    if 'type' in s: out['type'] = pick(s['type'], ['id', 'name', 'state', 'completed', 'description'])
    if 'result' in s: out['result'] = s['result']
    return out

def small_competition(c):
    out = pick(c, ['id', 'date', 'description'])
    if 'type' in c: out['type'] = pick(c['type'], ['id', 'text', 'abbreviation'])
    if 'format' in c: out['format'] = {'regulation': pick((c['format'] or {}).get('regulation') or {}, ['periods', 'clock'])}
    if 'cardSegment' in c: out['cardSegment'] = pick(c['cardSegment'], ['id', 'description', 'name'])
    out['competitors'] = [dict(pick(x, ['id', 'order', 'winner', 'type']), athlete=ref(x.get('athlete'))) for x in c.get('competitors') or []]
    out['status'] = ref(c.get('status'))
    return out

def save(name, data):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('saved', name)

def history(athlete, fights=3):
    log = get(f'{CORE}/athletes/{athlete}/eventlog')
    ev = log.get('events') or {}
    items = ev.get('items') or []
    print(f"eventlog of {athlete}: count {ev.get('count')}, page {ev.get('pageIndex')}/{ev.get('pageCount')} of {ev.get('pageSize')}, {len(items)} items here, played: {[i.get('played') for i in items][:8]}")
    # the first items of the list, as they come: enough to see their order and how an item is made
    save('athlete_eventlog.json', {'$ref': log.get('$ref'), 'events': dict(pick(ev, ['count', 'pageIndex', 'pageSize', 'pageCount']),
         items=[{'event': ref(i.get('event')), 'competition': ref(i.get('competition')), 'competitor': ref(i.get('competitor')), **pick(i, ['played'])} for i in items[:8]])})
    comps, stats = [], []
    for i in [x for x in items if x.get('played')][:fights]:
        c = get(i['competition']['$ref']); comps.append(small_competition(c))
        s = get(c['status']['$ref']); stats.append(small_status(s))
        print(f"  {c.get('date')} {(c.get('type') or {}).get('abbreviation')} winner {[(x.get('id'), x.get('winner')) for x in c.get('competitors') or []]} -> {(s.get('result') or {}).get('name')} R{s.get('period')} {s.get('displayClock')}")
    save('past_competitions.json', comps)
    save('past_statuses.json', stats)

def status(event, competition, name):
    s = get(f'{CORE}/leagues/ufc/events/{event}/competitions/{competition}/status')
    print(f"status {event}/{competition}: {(s.get('type') or {}).get('name')} -> {(s.get('result') or {}).get('name')} R{s.get('period')} {s.get('displayClock')}")
    save(f'status_{name}.json', small_status(s))

if __name__ == '__main__':
    a = sys.argv[1:]
    try:
        if len(a) >= 2 and a[0] == 'history' and a[1].isdigit(): history(a[1], int(a[2]) if len(a) > 2 and a[2].isdigit() else 3)
        elif len(a) == 4 and a[0] == 'status' and a[1].isdigit() and a[2].isdigit() and a[3].isalnum(): status(a[1], a[2], a[3])
        else: print(__doc__); sys.exit(2)
    except (urllib.error.URLError, OSError) as e:
        print(f'could not reach ESPN: {e}'); sys.exit(3)

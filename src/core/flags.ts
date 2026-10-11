import { plain } from './tip';

/* The flag of a country, from its name in English as the source writes it ("Brazil", "England", "USA"). The table is
   ours, not the source's: a name it does not know gets no flag, never a guessed one. Each line is the two-letter code
   of the country and the names it is known by. */
const NAMES = `
AF afghanistan|AL albania|DZ algeria|AS american samoa|AD andorra|AO angola|AG antigua and barbuda|AR argentina|AM armenia|AW aruba
AU australia|AT austria|AZ azerbaijan|BS bahamas|BH bahrain|BD bangladesh|BB barbados|BY belarus|BE belgium|BZ belize|BJ benin|BM bermuda
BT bhutan|BO bolivia|BA bosnia and herzegovina,bosnia-herzegovina,bosnia herzegovina,bosnia|BW botswana|BR brazil,brasil|BN brunei|BG bulgaria
BF burkina faso|BI burundi|KH cambodia|CM cameroon|CA canada|CV cape verde,cabo verde|CF central african republic|TD chad|CL chile|CN china
CO colombia|KM comoros|CG congo,republic of the congo|CD dr congo,congo dr,democratic republic of the congo,democratic republic of congo
CR costa rica|CI ivory coast,cote d'ivoire|HR croatia|CU cuba|CW curacao|CY cyprus|CZ czech republic,czechia|DK denmark|DJ djibouti|DM dominica
DO dominican republic|EC ecuador|EG egypt|SV el salvador|GQ equatorial guinea|ER eritrea|EE estonia|SZ eswatini,swaziland|ET ethiopia|FJ fiji
FI finland|FR france|GF french guiana|PF french polynesia,tahiti|GA gabon|GM gambia,the gambia|GE georgia|DE germany|GH ghana|GR greece|GD grenada
GP guadeloupe|GU guam|GT guatemala|GN guinea|GW guinea-bissau,guinea bissau|GY guyana|HT haiti|HN honduras|HK hong kong|HU hungary|IS iceland
IN india|ID indonesia|IR iran|IQ iraq|IE ireland,republic of ireland|IL israel|IT italy|JM jamaica|JP japan|JO jordan|KZ kazakhstan|KE kenya
XK kosovo|KW kuwait|KG kyrgyzstan,kyrgyz republic|LA laos|LV latvia|LB lebanon|LS lesotho|LR liberia|LY libya|LI liechtenstein|LT lithuania
LU luxembourg|MO macau,macao|MG madagascar|MW malawi|MY malaysia|MV maldives|ML mali|MT malta|MQ martinique|MR mauritania|MU mauritius|MX mexico
MD moldova|MC monaco|MN mongolia|ME montenegro|MA morocco|MZ mozambique|MM myanmar,burma|NA namibia|NP nepal|NL netherlands,the netherlands,holland
NC new caledonia|NZ new zealand|NI nicaragua|NE niger|NG nigeria|KP north korea|MK north macedonia,macedonia|NO norway|OM oman|PK pakistan
PS palestine|PA panama|PG papua new guinea|PY paraguay|PE peru|PH philippines|PL poland|PT portugal|PR puerto rico|QA qatar|RE reunion|RO romania
RU russia,russian federation|RW rwanda|WS samoa|SM san marino|SA saudi arabia|SN senegal|RS serbia|SC seychelles|SL sierra leone|SG singapore
SK slovakia|SI slovenia|SO somalia|ZA south africa|KR south korea,korea,korea republic,republic of korea|SS south sudan|ES spain|LK sri lanka
SD sudan|SR suriname|SE sweden|CH switzerland|SY syria|TW taiwan,chinese taipei|TJ tajikistan|TZ tanzania|TH thailand|TL timor-leste,east timor
TG togo|TO tonga|TT trinidad and tobago,trinidad & tobago|TN tunisia|TR turkey,turkiye|TM turkmenistan|UG uganda|UA ukraine
AE united arab emirates,uae|GB united kingdom,uk,great britain|US usa,united states,united states of america,us|UY uruguay|UZ uzbekistan
VE venezuela|VN vietnam,viet nam|VI us virgin islands,u.s. virgin islands,virgin islands|YE yemen|ZM zambia|ZW zimbabwe
`;
/** The home nations of the United Kingdom have flags of their own, written as a black flag followed by tag letters. */
const PARTS = new Map<string, string>([['england', 'gbeng'], ['scotland', 'gbsct'], ['wales', 'gbwls']]);
const CODES = new Map<string, string>();
for (const item of NAMES.split(/[\n|]/)) {
  const text = item.trim(); if (!text) continue;
  const at = text.indexOf(' ');
  for (const name of text.slice(at + 1).split(',')) CODES.set(plain(name), text.slice(0, at));
}
const letters = (code: string): string => [...code].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
/** What the table knows a country by: its two-letter code, or the tag of a home nation of the United Kingdom
 *  ("gbeng"); an empty text for a name it does not have. The page uses it to say the name in Portuguese. */
export function countryCode(country: unknown): string {
  const k = plain(String(country == null ? '' : country)).trim();
  return PARTS.get(k) || CODES.get(k) || '';
}
/** The flag of a country by its name, as an emoji; an empty text for a name the table does not have. */
export function flagOf(country: unknown): string {
  const k = plain(String(country == null ? '' : country)).trim(); if (!k) return '';
  const part = PARTS.get(k), code = CODES.get(k);
  if (part) return String.fromCodePoint(0x1F3F4, ...[...part].map(c => 0xE0000 + c.charCodeAt(0)), 0xE007F);
  return code ? letters(code) : '';
}

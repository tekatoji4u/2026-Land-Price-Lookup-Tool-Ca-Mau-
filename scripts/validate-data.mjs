// Kiểm tra data.json trước khi đưa lên. Chạy: node scripts/validate-data.mjs
// Lỗi (error) làm thất bại; cảnh báo (warn) chỉ in ra để người nhập liệu xem lại.
import { readFileSync } from 'node:fs';

const file = new URL('../data.json', import.meta.url);
const data = JSON.parse(readFileSync(file, 'utf8'));
const errors = [], warns = [];
const err = m => errors.push(m), warn = m => warns.push(m);

function checkText(s, where){
  if(s === null) return;
  if(typeof s !== 'string'){ err(`${where}: phải là chuỗi hoặc null`); return; }
  if(s !== s.normalize('NFC')) err(`${where}: dấu tiếng Việt chưa chuẩn NFC: "${s}"`);
  if(s !== s.trim() || /\s{2,}/.test(s)) err(`${where}: thừa khoảng trắng: "${s}"`);
  if(s === '') err(`${where}: chuỗi rỗng, dùng null`);
  // Ký tự Latin lạ thường do gõ sai bảng mã (ví dụ Ǜ, Ĕ).
  const odd = s.match(/[Ā-ſǍ-ǜ]/gu)?.filter(c => !'ĐđĂăĨĩŨũƠơƯư'.includes(c));
  if(odd?.length) err(`${where}: ký tự lạ ${odd.join('')} trong "${s}"`);
}

if(!data.meta?.nghi_quyet) err('meta.nghi_quyet: thiếu');
if(!/^\d{4}-\d{2}-\d{2}$/.test(data.meta?.cap_nhat || '')) err('meta.cap_nhat: phải có dạng YYYY-MM-DD');

const names = new Set();
for(const [i, k] of (data.khu_vuc || []).entries()){
  const at = `khu_vuc[${i}] ${k.ten}`;
  checkText(k.ten, at + '.ten');
  if(k.ten !== k.ten.toUpperCase()) err(`${at}: tên phải viết hoa toàn bộ`);
  const loai = k.ten.startsWith('XÃ ') ? 'xa' : k.ten.startsWith('PHƯỜNG ') ? 'phuong' : null;
  if(!loai) err(`${at}: tên phải bắt đầu bằng "XÃ " hoặc "PHƯỜNG "`);
  if(k.loai !== loai) err(`${at}: loai="${k.loai}" không khớp tên`);
  if(names.has(k.ten)) err(`${at}: trùng tên khu vực`);
  names.add(k.ten);
  if(!Array.isArray(k.rows) || !k.rows.length) err(`${at}: không có dòng giá`);

  const seen = new Map();
  k.rows.forEach((r, j) => {
    const rw = `${at} dòng ${j + 1}`;
    if(!Array.isArray(r) || r.length !== 6){ err(`${rw}: phải có 6 cột [đường, từ, đến, giá, mục, nhóm]`); return; }
    [0, 1, 2, 4, 5].forEach(c => checkText(r[c], `${rw} cột ${c + 1}`));
    if(!r[0]) err(`${rw}: thiếu tên đường`);
    if(!Number.isInteger(r[3]) || r[3] <= 0) err(`${rw}: giá phải là số nguyên dương (nghìn đ/m²), đang là ${JSON.stringify(r[3])}`);
    else if(r[3] < 100 || r[3] > 200000) warn(`${rw}: giá ${r[3]} bất thường, kiểm tra lại`);
    const key = JSON.stringify([r[0], r[1], r[2], r[4], r[5]]);
    if(seen.has(key) && seen.get(key) !== r[3]) warn(`${rw}: cùng tuyến/đoạn/nhóm nhưng khác giá (${seen.get(key)} và ${r[3]}): ${r[0]} ${r[1] || ''}`);
    seen.set(key, r[3]);
  });
}

for(const [i, r] of (data.nong_nghiep || []).entries()){
  checkText(r.loai_dat, `nong_nghiep[${i}].loai_dat`);
  for(const f of ['khu_vuc_1', 'khu_vuc_2']) if(!Number.isInteger(r[f]) || r[f] <= 0) err(`nong_nghiep[${i}].${f}: phải là số nguyên dương`);
}

const rows = data.khu_vuc.reduce((s, k) => s + k.rows.length, 0);
console.log(`${data.khu_vuc.length} khu vực, ${rows} dòng giá, ${data.nong_nghiep.length} loại đất nông nghiệp.`);
warns.forEach(m => console.log('CẢNH BÁO  ' + m));
errors.forEach(m => console.log('LỖI       ' + m));
console.log(`${errors.length} lỗi, ${warns.length} cảnh báo.`);
process.exit(errors.length ? 1 : 0);

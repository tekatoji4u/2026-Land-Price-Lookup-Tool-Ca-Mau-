# LandBeacon — Bảng giá đất Cà Mau 2026

Web app tra cứu bảng giá đất tỉnh Cà Mau áp dụng từ 01/01/2026 theo Nghị quyết 16/2025/NQ-HĐND. Chạy hoàn toàn tĩnh trên GitHub Pages, không cần máy chủ hay thư viện ngoài.

## Cấu trúc

| Tệp | Nội dung |
| --- | --- |
| `index.html` | Khung trang |
| `styles.css` | Giao diện (sáng/tối, điện thoại, máy tính bảng, máy tính) |
| `app.js` | Tìm kiếm, điều hướng, máy tính giá |
| `data.json` | Toàn bộ số liệu bảng giá |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | Dùng khi mất mạng, cài lên màn hình chính |
| `scripts/validate-data.mjs` | Kiểm tra lỗi dữ liệu |

## Cập nhật dữ liệu

1. Sửa `data.json`. Mỗi dòng giá có dạng `[tên đường, từ, đến, giá (nghìn đ/m²), mục, nhóm]`.
2. Đổi `meta.cap_nhat` thành ngày cập nhật (YYYY-MM-DD).
3. Chạy `node scripts/validate-data.mjs`. Lệnh này cũng tự chạy trên GitHub mỗi khi `data.json` thay đổi.
4. Tăng `VERSION` trong `sw.js` để người dùng nhận dữ liệu mới.

## Chạy thử trên máy

```
python3 -m http.server 8000
```

rồi mở http://localhost:8000.

# Đường Phố Việt v2 — Multiplayer xe máy Việt Nam

## Tính năng trong phiên bản 2
- Xe Wave mặc định; mua thêm Exciter, Vario và Winner bằng xu trong game.
- Phòng multiplayer qua mã phòng, đồng bộ vị trí xe bằng WebSocket.
- Bản đồ phố Việt cách điệu: nhà phố, quán, cây, vạch qua đường, vòng đường đua.
- Gara: mua xe, chọn xe đang sở hữu, nâng cấp pô tối đa 3 cấp.
- Thưởng 300 xu khi hoàn thành vòng chạy (cơ chế arcade demo).
- NPC cảnh sát giao thông tuần tra; va chạm khi chạy nhanh có thể bị trừ xu trong game.
- Chat phòng, nút cảm ứng ga/phanh/rẽ cho điện thoại.
- Bản đồ nhỏ có thể bật/tắt.

## Chạy local
Cài Node.js 18+, mở terminal trong thư mục dự án:
```bash
npm install
npm start
```
Mở http://localhost:3000. Mở nhiều tab hoặc điện thoại cùng Wi-Fi và cùng mã phòng để thử.

## Deploy online với Render
1. Tạo repository GitHub và tải toàn bộ nội dung thư mục dự án lên.
2. Đăng nhập Render: https://render.com/
3. Chọn New -> Blueprint, kết nối repository để Render đọc `render.yaml`.
   Hoặc tạo Web Service thủ công:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
   - Health check: `/health`
4. Deploy, đợi Render cấp URL HTTPS.
5. Gửi URL và mã phòng (ví dụ PHOVIET) cho bạn bè. Tất cả vào cùng URL và cùng mã phòng.

## Lưu ý kỹ thuật
- Đây là prototype 2D arcade, không phải mô phỏng vật lý chính xác và không dùng hình/nhãn hiệu chính thức của nhà sản xuất.
- Xe, giá, xu và nâng cấp được lưu trên RAM máy chủ trong phiên chạy; restart sẽ reset dữ liệu. Muốn giữ tiến trình cần thêm database và tài khoản.
- Server có kiểm tra sơ bộ tốc độ di chuyển, nhưng chưa phải chống gian lận hoàn chỉnh.
- Cảnh sát chỉ là NPC hư cấu trong game; không mô phỏng hay khuyến khích vi phạm luật ngoài đời.
- Gói hosting miễn phí có thể ngủ khi không hoạt động. Để có nhiều người chơi ổn định cần máy chủ luôn bật, lưu trữ bền vững, rate-limit, xác thực và giám sát.

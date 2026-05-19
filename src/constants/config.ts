// Cấu hình IP: sao chép .env.example thành .env rồi đặt EXPO_PUBLIC_API_URL=http://<IP_MAY>:8000
// Điện thoại và máy backend phải cùng mạng WiFi. Chạy `ipconfig` để lấy IP.

export const SERVER_URL = process.env.EXPO_PUBLIC_API_URL;
export const API_URL = SERVER_URL;

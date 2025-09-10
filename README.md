# Nöbetçi Eczane - Türkiye

Türkiye'deki nöbetçi eczaneleri bulmanızı sağlayan web uygulaması.

## Özellikler

- 🏥 Güncel nöbetçi eczane bilgileri
- 🌍 81 il desteği
- 📱 Responsive tasarım
- 🌙 Dark/Light tema
- ⚡ Hızlı arama

## Teknolojiler

- Node.js
- Express.js
- EJS Template Engine
- Tailwind CSS
- T.C. Sağlık Bakanlığı API

## Kurulum

```bash
npm install
npm run build
npm start
```

## Geliştirme

```bash
npm run dev
```

## Deployment

Bu proje Vercel'de deploy edilmek üzere yapılandırılmıştır.

### Vercel Environment Variables

Vercel dashboard'da aşağıdaki environment variables'ları ekleyin:

```
EXPRESS_SESSION_SECRET=43b27778bd48db90558924888693b98f11ddced77ed3fd01dfce23e1071d1df4
COOKIE_SECRET=cookie-secret-key-2024-nöbetçi-eczane-app
DUTY_API_URL=https://www.nosyapi.com/apiv2/service/pharmacies-on-duty
DUTY_API_KEY=Bearer YOUR_API_KEY_HERE
NODE_ENV=production
```

## Lisans

MIT

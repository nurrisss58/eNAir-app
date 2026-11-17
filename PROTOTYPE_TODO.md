# Прототип: что уже есть и что осталось

Проверка `UnitFlightd.fig` от 13.11, 02:21.

## Статус

| Показатель | Значение |
|---|---|
| Интеракций всего | **83** |
| Внутренние переходы с целью | **53** |
| Ссылки на URL (гиперссылки из HTML) | **27** |
| Битые действия | **2** (overlay с несуществующей целью) |
| Flow starting points | **6** (Home, Seat, Profile, Help, Sign Up, Sign In) |
| Smart Animate | **1** (на DRAG, случайный) |
| Имена фреймов в секциях | ✅ переименованы |

**Уже связано:** Seat → Payment, Confirmation → Home, часть навигации в шапке.
**Не связано:** цепочка покупки от поиска до оплаты, вход, лояльность, мобильный.

## 1. Покупка — доделать

| Откуда | Элемент | Куда |
|---|---|---|
| `enair-homepage` | Search в hero | `Booking · Search` |
| `enair-booking` | Select у рейса | `Booking · Select Fare` |
| `Booking · Search` | Select у каждого рейса | `Booking · Select Fare` |
| `Booking · Select Fare` | карточка тарифа / Continue | `Booking · Passengers` |
| `Booking · Passengers` | Continue | `07 Seat Selection` |
| `07 Seat Selection` | Continue to payment | `Booking · Payment` ✅ есть |
| `Booking · Payment` | Pay | `09 Confirmation` |
| `09 Confirmation` | Back to home | `enair-homepage` ✅ есть |

«Назад»: Payment → Passengers, Passengers → Fare, Fare → Search, Search → Booking, Seat → Passengers.

## 2. Вход

| Откуда | Элемент | Куда |
|---|---|---|
| `10 Sign In` | Sign in | `12 Profile` |
| `10 Sign In` | Create account | `11 Create Account` |
| `11 Create Account` | Create account | `12 Profile` |
| `11 Create Account` | Sign in | `10 Sign In` ✅ есть |
| `12 Profile` | Sign out | `10 Sign In` |

## 3. Лояльность

| Откуда | Элемент | Куда |
|---|---|---|
| `enair-loyalty` | Join eNAir Rewards | `14 Rewards Enrollment` |
| `14 Rewards Enrollment` | Create rewards profile | `12 Profile` |
| `14 Rewards Enrollment` | Back to Loyalty | `enair-loyalty` |

## 4. Мобильный и поддержка

| Откуда | Элемент | Куда |
|---|---|---|
| `29 Mobile Search` | ← Back | `Mobile booking` |
| `25 Help Center` | Sign in | `10 Sign In` ✅ есть |
| `Mobile homepage` | ☰ | overlay `S4 Mobile menu` — сейчас цель битая |
| `25 Help Center` | Open assistant | `26 AI Concierge`, если он есть |

## 5. Почистить

1. **Битый overlay** (2 действия с целью `-1`) — выдели кнопку меню на Mobile Home и заново выбери цель overlay. Если фрейма меню нет — удали действие.
2. **Smart Animate на DRAG** — случайный. Удали или перенастрой на `ON_CLICK` с осмысленным переходом.
3. **Dead links в Profile** (My bookings, Miles, Payment methods, Settings) — у них нет цели. Либо убери интеракции, либо веди на тот же экран/секцию.
4. **27 URL-ссылок** — это `<a href>` из HTML, они открывают сайт в браузере, а не экран. Для сценариев нужны внутренние переходы.
5. **Starting points** — оставь 3–4: `Home` (покупка), `Sign In` (вход), `Loyalty`, `Mobile Home`. Остальные убери, чтобы не плодить потоки.

## Как проверить

`Present` → начни с Home → пройди покупку до Confirmation. Если где-то клик ничего не делает — там нет перехода.

## Дальше

- Mobile Search: ширина 1440 → обрезать/переимпортировать в 401.
- 3–5 состояний + Smart Animate.
- UI Kit, Figma Make, Cover.

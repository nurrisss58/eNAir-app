# Figma Make: готовый промпт для eNAir

> Как пользоваться: Figma → **Drafts** → **Make** → новый файл → прикрепи фрейм **10 Sign In**
> (или 01 Home) как референс стиля → вставь промпт ниже целиком → отправь.
> Дальше правь короткими сообщениями из блока «Доработки».

---

## Промпт (копировать целиком)

```
Build a polished, fully interactive front-end demo for "eNAir" — a next-generation airline with a
hydrogen-electric fleet. It must look like the attached Figma frame: light, premium, airy.

VISUAL SYSTEM
- Background #F8FAFC, surfaces #FFFFFF, text #0F172A, muted #64748B, borders #E2E8F0.
- Accents: cyan #06B6D4 and violet #8B5CF6. Primary CTAs use a 135° gradient cyan → violet.
- Fonts: Outfit for headings (700/800), Geist for body (400/500/600). Load from Google Fonts.
- Radii: cards 24px, inputs and buttons 16px, pills 100px. Shadow on cards: 0 8px 24px rgba(139,92,246,.06).
- 8px spacing grid, container max-width 1280px, generous whitespace, no clutter.
- Icons: lucide-react, 1.5px stroke, 16–20px.

SCREENS (client-side routing, one app, no backend)
1. Sign In — split layout: left photo panel with a short quote, right form card.
   Fields: Email, Password (with show/hide), "Remember me" toggle, "Forgot password?" link.
   Buttons: Sign in (gradient), divider "or", Continue with Google (mock), link to Create account.
2. Create Account — First name, Last name, Email, Password (strength meter with 4 segments),
   Confirm password, Terms checkbox. Button "Create account", link back to Sign in.
3. Flight Search — From / To (select of 8 airports), Departure / Return dates, Passengers (1–9),
   Cabin (Economy/Premium/Business/First), Round-trip / One-way switch. Button "Search flights".
4. Results — date strip, sort and filters (non-stop toggle, max price), 4 flight cards with
   times, duration, aircraft, price in KZT, "Select" button; one card is sold out.
5. Booking summary modal — passenger names, fare, total, "Continue to payment".

DATA
Static array of 6 flights: JFK→LHR, LHR→JFK, JFK→NRT, SIN→SYD, ALA→DXB, LHR→FCO with realistic
times, durations (7h 15m etc.), aircraft (A350-H2, 787-E, A380-X) and prices in KZT (₸180,000–₸650,000).
No lorem ipsum: write realistic airline copy.

VALIDATION (must be real, on blur and on submit)
- Email: standard format; error "Enter a valid email address".
- Password: min 8 chars, at least one letter and one number; error describes exactly what is missing.
- Confirm password must match; error "Passwords don't match".
- First/Last name: min 2 letters; error "Enter your first name".
- Terms must be checked; error "Accept the terms to continue".
- Search: From and To must differ ("Choose different airports"); date must be today or later
  ("Pick a date from today onward"); return date after departure.
- Show errors inline under fields, red border (#DC2626), aria-invalid, and a form-level summary
  at the top of the form when submit fails. Focus the first invalid field.

STATES AND FEEDBACK
- Empty, focused, filled, error, disabled, loading (spinner on the submit button, 900 ms).
- Success: green toast bottom-center ("Welcome back, Alex" / "Account created" / "Flight selected"),
  then navigate to the next screen.
- Wrong credentials: for demo, signing in with any password shorter than 8 shows
  "Email or password is incorrect".
- Results: if filters remove everything, show an empty state with "No flights match" and a Reset button.
- Persist user and booking draft in localStorage so a page refresh keeps the state.

QUALITY
- Responsive: 1680, 1280, 768 and 390 px; mobile menu; forms usable with the keyboard.
- Accessible: labels tied to inputs, visible focus rings, Enter submits, Escape closes modal.
- Clean component structure (Button, Input, Field, Card, Toast) and sensible file split.
- No external UI kits; plain CSS or Tailwind, React only.
- Include a small "DEMO" badge in the header and a note that payment is simulated.
```

---

## Доработки (по одному сообщению)

1. `Add a payment step with card fields: number (auto-formatted 4-4-4-4), expiry MM/YY, CVC, cardholder. Validate with Luhn. Card 4000 0000 0000 0002 must show "Card declined. Try another card.", 4242 4242 4242 4242 succeeds. Show a success receipt with booking reference EN###### and a "Back to home" button.`
2. `Make the results screen support sorting by price and departure, and add a non-stop toggle. Animate card filtering with a 200ms fade.`
3. `Add a miles calculator: distance by haversine between selected airports, tier multiplier Silver 10%, Gold 25%, Platinum 50%, cabin bonus. Show the breakdown.`
4. `Match the attached design more closely: heading sizes 72/40/24, card radius 24, button height 48, nav height 72 with 80px side padding.`
5. `Add an error state and a loading skeleton for the flight list (1.2s simulated fetch).`

---

## Демо на защите (60 секунд)

1. `Sign in` с пустыми полями → две ошибки, фокус на email.
2. Ввести `alex@` → «Enter a valid email address».
3. Ввести валидный email и пароль `123` → «Password must be 8+ characters with a number».
4. Пароль `enair2026` → тост «Welcome back» → профиль.
5. Поиск: `JFK → JFK` → «Choose different airports».
6. `JFK → LHR`, дата в прошлом → «Pick a date from today onward».
7. Валидный поиск → результаты → Select → сводка → оплата.
8. Карта `4000 0000 0000 0002` → «Card declined»; `4242 4242 4242 4242` → чек с номером брони.

---

## Публикация и встраивание

- **Starter (бесплатно):** Make доступен, но публикация на веб — с ограничениями (нужно публиковать
  и в Figma Community). Для защиты достаточно **Preview** прямо в Figma Make.
- **Платные планы:** `Share → Publish` → ссылка на живой апп.
- В Figma Design: страница `06 Figma Make` → 3 скриншота + ссылка + QR-код (плагин QR Code).
- В прототипе: на экране 10 Sign In → hotspot `Try live demo` → `On click → Open link`.

## Если Make недоступен

Запасной вариант: живой Flask-сайт (`python app.py`) уже имеет работающие формы с валидацией и
сообщениями об ошибках — покажи его как «программную реализацию», а Figma Make — как «AI-прототип».
На защите это сильнее, чем только макет.

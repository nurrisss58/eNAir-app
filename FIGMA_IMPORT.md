# Импорт в Figma: 15 страниц, пошагово

> Короткий сценарий на один вечер. Полный план — в `FIGMA_PLAN.md`, спеки — там же в §5.
> В файле уже есть 13 фреймов; ниже — чего не хватает.

## 0. Перед началом (5 минут)

1. Открой `UnitFlightd.fig` в Figma.
2. Удали/заархивируй **Page 3** и **Page 4** — это дубли.
3. Создай страницы: `00 Cover`, `01 UI Kit`, `05 States`, `06 User Flows`, `07 Figma Make`.
4. В плагине **html.to.design** выстави: viewport **1440** (мобилка — **401**), full page height ON,
   create styles ON, hyperlinks ON, layer names ON, auto layout OFF.

## 1. Импорт 8 страниц с Render (URL)

Плагин → вкладка **Web** → вставь URL → Import. После каждого импорта переименуй фрейм.

| № | Фрейм | URL | ✓ |
|---|---|---|---|
| 14 | Rewards Enrollment | `https://enair-app-1.onrender.com/enair-rewards-enrollment.html` | ☐ |
| 16 | Aircraft A350 | `https://enair-app-1.onrender.com/fleet-a350.html` | ☐ |
| 17 | Aircraft 787 | `https://enair-app-1.onrender.com/fleet-787.html` | ☐ |
| 18 | Aircraft A380 | `https://enair-app-1.onrender.com/fleet-a380.html` | ☐ |
| 19 | Guest Experience | `https://enair-app-1.onrender.com/enair-experiences.html` | ☐ |
| 21 | Curated: Iceland | `https://enair-app-1.onrender.com/curated-iceland.html` | ☐ |
| 22 | Curated: Vietnam & Bali | `https://enair-app-1.onrender.com/curated-vietnam-bali.html` | ☐ |
| 23 | Curated: Greece | `https://enair-app-1.onrender.com/curated-greece.html` | ☐ |

## 2. Импорт 7 новых экранов (localhost)

Запусти сервер в папке проекта:

```powershell
cd N:\Hcinter
python app.py
```

Дальше — расширение **html.to.design** в Chrome (страницы локальные, плагин до localhost не достанет):
открой страницу, включи DevTools → device toolbar → ширина **1440** (для 29 — **401**),
Capture full page → Copy → в Figma `Ctrl+V`.

| № | Фрейм | URL | ✓ |
|---|---|---|---|
| 07 | Seat Selection | `http://127.0.0.1:5000/booking-seats.html` | ☐ |
| 09 | Confirmation | `http://127.0.0.1:5000/booking-confirmation.html` | ☐ |
| 10 | Sign In | `http://127.0.0.1:5000/enair-signin.html` | ☐ |
| 11 | Create Account | `http://127.0.0.1:5000/enair-signup.html` | ☐ |
| 12 | Profile | `http://127.0.0.1:5000/enair-profile.html` | ☐ |
| 25 | Help Center | `http://127.0.0.1:5000/enair-help.html` | ☐ |
| 29 | Mobile Search | `http://127.0.0.1:5000/mobile-search.html` (401 px) | ☐ |

## 3. Раскладка

- `02 Desktop` — 01–26, три колонки, зазор 200 px.
- `03 Mobile` — 27–30.
- Имена: `01 Home` … `30 Mobile Payment` (номер = порядок в сценарии).

## 4. Связка (1 час)

Таблицы переходов — `FIGMA_PLAN.md` §7. Минимум для зачёта:

1. Покупка: `01 → 04 → 05 → 06 → 07 → 08 → 09 → 01`.
2. Вход: `10 → S1 → 11 → S2 → 12`.
3. Лояльность: `13 → 14 → 12`.
4. Поддержка: `20 → 25 → 26`.
5. Мобильный: `27 → 29 → 30 → 09`.

Высокие фреймы: `Scroll → Overflow: Vertical`. «Назад» — действием **Back**.

## 5. Бесплатный тариф: 10 импортов в месяц, а нужно 15

html.to.design бесплатно даёт **10 импортов**, потом ещё 10 каждый месяц (с бесплатным аккаунтом
divRIOTS ONE). Платно — $18/мес или $12/мес при годовой оплате. Поэтому:

**Раскладка на free-плане (10 импортов, ~2 часа):**

| Что | Как | Кредиты |
|---|---|---|
| 8 страниц из §1 | импорт | 8 |
| 07 Seat Selection | импорт (самый сложный) | 1 |
| 12 Profile | импорт (самый плотный) | 1 |
| 09, 10, 11, 25, 29 | нарисовать по HTML-референсу | 0 |
| **Итого** | **28 фреймов** | **10** |

Пять простых экранов (форма входа, регистрация, подтверждение, помощь, мобильный поиск) рисуются
за 1–1,5 часа: открой соответствующую страницу в браузере и повтори блоки — там всё уже
спозиционировано, размеры и тексты готовы.

**Если не хочешь рисовать:** PRO на один месяц ($12–18) → импортируй все 15.
**Если не хочешь платить:** скажи — напишу Figma-плагин, который создаст 7 экранов прямо в файле
без импортов (Plugins → Development → Import plugin from manifest).

## 6. После импорта

- Собери **UI Kit** (`FIGMA_PLAN.md` §6) — в файле нет ни одного компонента и стиля.
- Сделай состояния **S1–S6** копиями экранов и настрой Smart Animate (§8).
- Figma Make — по `FIGMA_MAKE_PROMPT.md`.

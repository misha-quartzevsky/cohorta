/// <reference path="../pb_data/types.d.ts" />

// ============================================================
//  A0.5 (разведка 2026-10-18) — дыра в доступе: decks/deck_cards.
//
//  `decks` после 1787615000 получил owner-правило, но без
//  поддержки `is_public` (поле есть, в правиле не участвовало).
//  `deck_cards` создавался с правилами "" (1787130100) и с тех
//  пор НИ РАЗУ не менялся — сейчас открыт всем, даже без входа:
//  чужую колоду можно читать/менять/удалять карточка за карточкой,
//  даже если сама `decks`-запись уже защищена.
//
//  Исправление: единое правило и для decks, и для deck_cards —
//  владельцу всё; остальным вошедшим — только чтение, и только
//  если `is_public = true`; записям без владельца (legacy/демо)
//  видимость как раньше. deck_cards не имеет своего owner — его
//  правило ссылается на `deck.owner`/`deck.is_public` через связь.
// ============================================================

const DECK_READ =
  "owner = \"\" || (@request.auth.id != \"\" && (owner = @request.auth.id || is_public = true))";
const DECK_WRITE = "@request.auth.id != \"\" && owner = @request.auth.id";

const CARD_READ =
  "deck.owner = \"\" || (@request.auth.id != \"\" && (deck.owner = @request.auth.id || deck.is_public = true))";
const CARD_WRITE = "@request.auth.id != \"\" && deck.owner = @request.auth.id";

migrate((app) => {
  const decks = app.findCollectionByNameOrId("decks");
  unmarshal(
    {
      listRule: DECK_READ,
      viewRule: DECK_READ,
      createRule: DECK_WRITE,
      updateRule: DECK_WRITE,
      deleteRule: DECK_WRITE,
    },
    decks
  );
  app.save(decks);

  const cards = app.findCollectionByNameOrId("deck_cards");
  unmarshal(
    {
      listRule: CARD_READ,
      viewRule: CARD_READ,
      createRule: CARD_WRITE,
      updateRule: CARD_WRITE,
      deleteRule: CARD_WRITE,
    },
    cards
  );
  app.save(cards);

  console.log("deck access holes closed: decks (+is_public), deck_cards (owner via deck relation)");
}, (app) => {
  // DOWN: decks назад к состоянию 1787615000 (owner без is_public);
  // deck_cards назад к исходным открытым правилам (1787130100).
  const OWN = "owner = \"\" || owner = @request.auth.id";
  const decks = app.findCollectionByNameOrId("decks");
  unmarshal(
    {
      listRule: OWN,
      viewRule: OWN,
      createRule: "@request.auth.id != \"\"",
      updateRule: OWN,
      deleteRule: OWN,
    },
    decks
  );
  app.save(decks);

  const cards = app.findCollectionByNameOrId("deck_cards");
  unmarshal(
    {
      listRule: "",
      viewRule: "",
      createRule: "",
      updateRule: "",
      deleteRule: "",
    },
    cards
  );
  app.save(cards);
})

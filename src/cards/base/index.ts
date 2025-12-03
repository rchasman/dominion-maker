import type { CardName } from "../../types/game-state";
import type { CardEffect } from "../card-effect";

import { artisan } from "./artisan";
import { bandit } from "./bandit";
import { bureaucrat } from "./bureaucrat";
import { cellar } from "./cellar";
import { chapel } from "./chapel";
import { councilRoom } from "./council-room";
import { festival } from "./festival";
import { gardens } from "./gardens";
import { harbinger } from "./harbinger";
import { laboratory } from "./laboratory";
import { library } from "./library";
import { market } from "./market";
import { merchant } from "./merchant";
import { militia } from "./militia";
import { mine } from "./mine";
import { moat } from "./moat";
import { moneylender } from "./moneylender";
import { poacher } from "./poacher";
import { remodel } from "./remodel";
import { sentry } from "./sentry";
import { smithy } from "./smithy";
import { throneRoom } from "./throne-room";
import { vassal } from "./vassal";
import { village } from "./village";
import { witch } from "./witch";
import { workshop } from "./workshop";

export const BASE_CARD_EFFECTS: Record<CardName, CardEffect> = {
  // $2 Cost
  Cellar: cellar,
  Chapel: chapel,
  Moat: moat,

  // $3 Cost
  Harbinger: harbinger,
  Merchant: merchant,
  Vassal: vassal,
  Village: village,
  Workshop: workshop,

  // $4 Cost
  Bureaucrat: bureaucrat,
  Gardens: gardens,
  Militia: militia,
  Moneylender: moneylender,
  Poacher: poacher,
  Remodel: remodel,
  Smithy: smithy,
  "Throne Room": throneRoom,

  // $5 Cost
  Bandit: bandit,
  "Council Room": councilRoom,
  Festival: festival,
  Laboratory: laboratory,
  Library: library,
  Market: market,
  Mine: mine,
  Sentry: sentry,
  Witch: witch,

  // $6 Cost
  Artisan: artisan,

  // Base cards (no effects when played as actions)
  Copper: gardens, // No effect
  Silver: gardens, // No effect
  Gold: gardens, // No effect
  Estate: gardens, // No effect
  Duchy: gardens, // No effect
  Province: gardens, // No effect
  Curse: gardens, // No effect
};

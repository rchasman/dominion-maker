import { describe, it, expect } from "bun:test";
import { getCardImageUrl, getCardImageFallbackUrl } from "./card-urls";
import type { CardName } from "../types/game-state";

describe("getCardImageUrl", () => {
  it("should return correct URL for single word cards", () => {
    expect(getCardImageUrl("Copper")).toBe("/cards/Copper.webp");
    expect(getCardImageUrl("Silver")).toBe("/cards/Silver.webp");
    expect(getCardImageUrl("Gold")).toBe("/cards/Gold.webp");
    expect(getCardImageUrl("Estate")).toBe("/cards/Estate.webp");
    expect(getCardImageUrl("Village")).toBe("/cards/Village.webp");
  });

  it("should replace spaces with underscores for multi-word cards", () => {
    expect(getCardImageUrl("Throne Room")).toBe("/cards/Throne_Room.webp");
    expect(getCardImageUrl("Council Room")).toBe("/cards/Council_Room.webp");
  });

  it("should use webp format", () => {
    const url = getCardImageUrl("Copper");
    expect(url.endsWith(".webp")).toBe(true);
  });

  it("should use /cards/ prefix", () => {
    const url = getCardImageUrl("Copper");
    expect(url.startsWith("/cards/")).toBe(true);
  });

  it("should handle all treasure cards", () => {
    expect(getCardImageUrl("Copper")).toBe("/cards/Copper.webp");
    expect(getCardImageUrl("Silver")).toBe("/cards/Silver.webp");
    expect(getCardImageUrl("Gold")).toBe("/cards/Gold.webp");
  });

  it("should handle all victory cards", () => {
    expect(getCardImageUrl("Estate")).toBe("/cards/Estate.webp");
    expect(getCardImageUrl("Duchy")).toBe("/cards/Duchy.webp");
    expect(getCardImageUrl("Province")).toBe("/cards/Province.webp");
    expect(getCardImageUrl("Gardens")).toBe("/cards/Gardens.webp");
  });

  it("should handle curse card", () => {
    expect(getCardImageUrl("Curse")).toBe("/cards/Curse.webp");
  });

  it("should handle all cost 2 kingdom cards", () => {
    expect(getCardImageUrl("Cellar")).toBe("/cards/Cellar.webp");
    expect(getCardImageUrl("Chapel")).toBe("/cards/Chapel.webp");
    expect(getCardImageUrl("Moat")).toBe("/cards/Moat.webp");
  });

  it("should handle all cost 3 kingdom cards", () => {
    expect(getCardImageUrl("Harbinger")).toBe("/cards/Harbinger.webp");
    expect(getCardImageUrl("Merchant")).toBe("/cards/Merchant.webp");
    expect(getCardImageUrl("Vassal")).toBe("/cards/Vassal.webp");
    expect(getCardImageUrl("Village")).toBe("/cards/Village.webp");
    expect(getCardImageUrl("Workshop")).toBe("/cards/Workshop.webp");
  });

  it("should handle all cost 4 kingdom cards", () => {
    expect(getCardImageUrl("Bureaucrat")).toBe("/cards/Bureaucrat.webp");
    expect(getCardImageUrl("Gardens")).toBe("/cards/Gardens.webp");
    expect(getCardImageUrl("Militia")).toBe("/cards/Militia.webp");
    expect(getCardImageUrl("Moneylender")).toBe("/cards/Moneylender.webp");
    expect(getCardImageUrl("Poacher")).toBe("/cards/Poacher.webp");
    expect(getCardImageUrl("Remodel")).toBe("/cards/Remodel.webp");
    expect(getCardImageUrl("Smithy")).toBe("/cards/Smithy.webp");
    expect(getCardImageUrl("Throne Room")).toBe("/cards/Throne_Room.webp");
  });

  it("should handle all cost 5 kingdom cards", () => {
    expect(getCardImageUrl("Bandit")).toBe("/cards/Bandit.webp");
    expect(getCardImageUrl("Council Room")).toBe("/cards/Council_Room.webp");
    expect(getCardImageUrl("Festival")).toBe("/cards/Festival.webp");
    expect(getCardImageUrl("Laboratory")).toBe("/cards/Laboratory.webp");
    expect(getCardImageUrl("Library")).toBe("/cards/Library.webp");
    expect(getCardImageUrl("Market")).toBe("/cards/Market.webp");
    expect(getCardImageUrl("Mine")).toBe("/cards/Mine.webp");
    expect(getCardImageUrl("Sentry")).toBe("/cards/Sentry.webp");
    expect(getCardImageUrl("Witch")).toBe("/cards/Witch.webp");
  });

  it("should handle cost 6 kingdom cards", () => {
    expect(getCardImageUrl("Artisan")).toBe("/cards/Artisan.webp");
  });

  it("should preserve case in card names", () => {
    expect(getCardImageUrl("Copper")).toContain("Copper");
    expect(getCardImageUrl("Copper")).not.toContain("copper");
  });

  it("should not add extra slashes", () => {
    const url = getCardImageUrl("Copper");
    expect(url).not.toContain("//");
  });
});

describe("getCardImageFallbackUrl", () => {
  it("should return correct fallback URL for single word cards", () => {
    expect(getCardImageFallbackUrl("Copper")).toBe("/cards/Copper.jpg");
    expect(getCardImageFallbackUrl("Silver")).toBe("/cards/Silver.jpg");
    expect(getCardImageFallbackUrl("Gold")).toBe("/cards/Gold.jpg");
  });

  it("should replace spaces with underscores for multi-word cards", () => {
    expect(getCardImageFallbackUrl("Throne Room")).toBe(
      "/cards/Throne_Room.jpg",
    );
    expect(getCardImageFallbackUrl("Council Room")).toBe(
      "/cards/Council_Room.jpg",
    );
  });

  it("should use jpg format", () => {
    const url = getCardImageFallbackUrl("Copper");
    expect(url.endsWith(".jpg")).toBe(true);
  });

  it("should use /cards/ prefix", () => {
    const url = getCardImageFallbackUrl("Copper");
    expect(url.startsWith("/cards/")).toBe(true);
  });

  it("should handle all treasure cards", () => {
    expect(getCardImageFallbackUrl("Copper")).toBe("/cards/Copper.jpg");
    expect(getCardImageFallbackUrl("Silver")).toBe("/cards/Silver.jpg");
    expect(getCardImageFallbackUrl("Gold")).toBe("/cards/Gold.jpg");
  });

  it("should handle all victory cards", () => {
    expect(getCardImageFallbackUrl("Estate")).toBe("/cards/Estate.jpg");
    expect(getCardImageFallbackUrl("Duchy")).toBe("/cards/Duchy.jpg");
    expect(getCardImageFallbackUrl("Province")).toBe("/cards/Province.jpg");
    expect(getCardImageFallbackUrl("Gardens")).toBe("/cards/Gardens.jpg");
  });

  it("should handle curse card", () => {
    expect(getCardImageFallbackUrl("Curse")).toBe("/cards/Curse.jpg");
  });

  it("should handle multi-word kingdom cards", () => {
    expect(getCardImageFallbackUrl("Throne Room")).toBe(
      "/cards/Throne_Room.jpg",
    );
    expect(getCardImageFallbackUrl("Council Room")).toBe(
      "/cards/Council_Room.jpg",
    );
  });

  it("should preserve case in card names", () => {
    expect(getCardImageFallbackUrl("Copper")).toContain("Copper");
    expect(getCardImageFallbackUrl("Copper")).not.toContain("copper");
  });

  it("should not add extra slashes", () => {
    const url = getCardImageFallbackUrl("Copper");
    expect(url).not.toContain("//");
  });
});

describe("URL format comparison", () => {
  it("should have same path structure, different extensions", () => {
    const webpUrl = getCardImageUrl("Copper");
    const jpgUrl = getCardImageFallbackUrl("Copper");
    expect(webpUrl.replace(".webp", ".jpg")).toBe(jpgUrl);
  });

  it("should handle multi-word cards consistently", () => {
    const webpUrl = getCardImageUrl("Throne Room");
    const jpgUrl = getCardImageFallbackUrl("Throne Room");
    expect(webpUrl.replace(".webp", ".jpg")).toBe(jpgUrl);
    expect(webpUrl).toContain("Throne_Room");
    expect(jpgUrl).toContain("Throne_Room");
  });

  it("should use same naming convention for both formats", () => {
    const cards: CardName[] = [
      "Copper",
      "Throne Room",
      "Council Room",
      "Village",
      "Estate",
    ];
    cards.forEach(card => {
      const webpUrl = getCardImageUrl(card);
      const jpgUrl = getCardImageFallbackUrl(card);
      const webpPath = webpUrl.replace(".webp", "");
      const jpgPath = jpgUrl.replace(".jpg", "");
      expect(webpPath).toBe(jpgPath);
    });
  });
});

describe("URL generation - edge cases", () => {
  it("should handle cards with multiple spaces (if any)", () => {
    const cardName = "Throne Room" as CardName;
    const url = getCardImageUrl(cardName);
    expect(url).toBe("/cards/Throne_Room.webp");
    expect(url).not.toContain(" ");
  });

  it("should not double-replace underscores", () => {
    const cardName = "Throne Room" as CardName;
    const url = getCardImageUrl(cardName);
    const underscoreCount = (url.match(/_/g) || []).length;
    const spaceCount = (cardName.match(/ /g) || []).length;
    expect(underscoreCount).toBe(spaceCount);
  });

  it("should generate consistent URLs for the same card", () => {
    const url1 = getCardImageUrl("Copper");
    const url2 = getCardImageUrl("Copper");
    expect(url1).toBe(url2);
  });

  it("should generate different URLs for different cards", () => {
    const url1 = getCardImageUrl("Copper");
    const url2 = getCardImageUrl("Silver");
    expect(url1).not.toBe(url2);
  });
});

describe("URL structure validation", () => {
  it("should always start with forward slash", () => {
    expect(getCardImageUrl("Copper")[0]).toBe("/");
    expect(getCardImageFallbackUrl("Copper")[0]).toBe("/");
  });

  it("should have exactly 3 path segments", () => {
    const url = getCardImageUrl("Copper");
    const segments = url.split("/").filter(s => s.length > 0);
    expect(segments.length).toBe(2); // ['cards', 'Copper.webp']
  });

  it("should have cards as first segment", () => {
    const url = getCardImageUrl("Copper");
    const segments = url.split("/").filter(s => s.length > 0);
    expect(segments[0]).toBe("cards");
  });

  it("should have filename with extension as second segment", () => {
    const url = getCardImageUrl("Copper");
    const segments = url.split("/").filter(s => s.length > 0);
    expect(segments[1]).toMatch(/^[A-Z][a-z_]*\.(webp|jpg)$/);
  });
});

describe("Real-world usage patterns", () => {
  it("should work with common UI patterns", () => {
    const cardName: CardName = "Village";
    const imgSrc = getCardImageUrl(cardName);
    const fallbackSrc = getCardImageFallbackUrl(cardName);

    expect(typeof imgSrc).toBe("string");
    expect(typeof fallbackSrc).toBe("string");
    expect(imgSrc.length).toBeGreaterThan(0);
    expect(fallbackSrc.length).toBeGreaterThan(0);
  });

  it("should generate valid URL paths", () => {
    const cards: CardName[] = [
      "Copper",
      "Silver",
      "Gold",
      "Estate",
      "Village",
      "Throne Room",
    ];
    cards.forEach(card => {
      const url = getCardImageUrl(card);
      expect(url).toMatch(/^\/cards\/[A-Z][A-Za-z_]+\.webp$/);
    });
  });

  it("should be suitable for HTML img src attributes", () => {
    const url = getCardImageUrl("Copper");
    expect(url).not.toContain("<");
    expect(url).not.toContain(">");
    expect(url).not.toContain('"');
    expect(url).not.toContain("'");
  });
});

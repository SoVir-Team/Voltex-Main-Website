import { ChipSection } from "@/components/esp32/features/chip/ChipSection";
import { ReferenceDrawer } from "@/components/esp32/features/reference/ReferenceDrawer";

// Lazy route module: the chip section, its page pills and the page under them, and the reference
// reader that any page's citation opens with `?ref=`.
export function Component() {
  return (
    <>
      <ChipSection />
      <ReferenceDrawer />
    </>
  );
}

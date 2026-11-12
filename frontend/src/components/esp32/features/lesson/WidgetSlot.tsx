import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import type { PanelSpec, ResolvedLesson } from "@/components/esp32/domain/lesson";
import { Caption } from "@/components/esp32/ui/Caption";
import { ErrorBoundary } from "@/components/esp32/ui/ErrorBoundary";
import { WIDGETS, type WidgetId } from "@/components/esp32/widgets/registry";

interface WidgetSlotProps {
  widget: WidgetId;
  lesson: ResolvedLesson;
  panel?: PanelSpec;
  /** Name for errors and logs. */
  name: string;
}

/**
 * Mounts one registered widget: its code loads on demand (Suspense), and if it throws, only
 * this slot shows the error (ErrorBoundary). Keyed per lesson/variant so state never leaks.
 */
export function WidgetSlot({ widget, lesson, panel, name }: WidgetSlotProps) {
  const { t } = useTranslation("lesson");
  const Widget = WIDGETS[widget];
  return (
    <ErrorBoundary name={name} resetKey={`${lesson.id}.${lesson.variantKey ?? ""}`}>
      <Suspense fallback={<Caption>{t("widget.loading")}</Caption>}>
        <Widget key={`${lesson.id}.${lesson.variantKey ?? ""}`} lesson={lesson} panel={panel} />
      </Suspense>
    </ErrorBoundary>
  );
}

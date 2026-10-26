import { Component, lazy, Suspense, useContext, type ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { GenUIActionContext } from "../genui/GenUIBlock";
const Render = lazy(() => import("./OpenUIRenderer"));
// A partially emitted program must not take down the surrounding transcript.
// Retry when more source arrives, preserving the native renderer on success.
class ProgramBoundary extends Component<{ source: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previous: { source: string }) {
    if (this.state.failed && previous.source !== this.props.source) this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? <div role="status" className="my-4 text-muted-foreground">تعذر عرض هذا الجزء التفاعلي.</div> : this.props.children;
  }
}
export function OpenUIBlock({
  source,
  streaming = false,
}: {
  source: string;
  streaming?: boolean;
}) {
  const onSend = useContext(GenUIActionContext);
  const wait = <div className="my-4 h-40 animate-pulse rounded-lg bg-muted" />;
  return (
    <ClientOnly fallback={wait}>
      <Suspense fallback={wait}>
        <ProgramBoundary source={source}>
        <Render source={source} streaming={streaming} onSend={onSend} />
        </ProgramBoundary>
      </Suspense>
    </ClientOnly>
  );
}

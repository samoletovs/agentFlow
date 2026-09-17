import { Component, type ReactNode } from "react";

export class BlueprintErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("Dispatch Lab could not render the blueprint.", error.name);
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="lab-error" role="alert">
          <h2>This blueprint could not be displayed.</h2>
          <p>
            Choose another agent or reload the application. No agent or workflow has been run.
          </p>
          <button onClick={() => window.location.reload()}>Reload application</button>
        </section>
      );
    }
    return this.props.children;
  }
}

import { Component, type ReactNode } from 'react';

/**
 * The one place a render error lands. Without it React unmounts the whole
 * tree and the learner sees a white page; offline, the service worker keeps
 * serving that shell, so the blank page survives a reload. It sits inside the
 * shell, around the routed screen, so the navigation stays usable and the
 * text comes from the dictionary like everything else. Nothing the learner
 * stored is touched; reloading brings the screen back with the record intact.
 */
type Props = { children: ReactNode; body: string; reload: string };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page crashed" role="alert">
        <p>{this.props.body}</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>{this.props.reload}</button>
      </div>
    );
  }
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './portal/App';
import './portal/portal.css';
class ErrorBoundary extends React.Component<React.PropsWithChildren, {
    failed: boolean;
}> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? <main className="setup"><h1>Something went wrong</h1><p>Reload the workspace to try again.</p><button onClick={() => location.reload()}>Reload</button></main> : this.props.children; }
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);

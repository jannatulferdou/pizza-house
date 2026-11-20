import { T } from "../app/Locale";
import { Link } from "react-router-dom";
export function ErrorMessage({ message }: {
    message: string;
}) {
    return message ? (<p className="alert error" role="alert">
      <T>{message}</T>
    </p>) : null;
}
export function Loading() {
    return (<div className="loading-shell" role="status" aria-label="Loading the shop">
      <p>
        <span className="loading-dot"/><T space>{"Bringing the good stuff\u2026"}</T></p>
      <div className="loading-skeletons" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>);
}
export function EmptyState({ title, text, to = "/#menu", action = "Explore the menu", }: {
    title: string;
    text: string;
    to?: string;
    action?: string;
}) {
    return (<div className="empty-state">
      <h2><T>{title}</T></h2>
      <p><T>{text}</T></p>
      <Link className="pill dark" to={to}>
        <T>{action}</T> ↗
      </Link>
    </div>);
}

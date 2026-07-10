import { createHashRouter, Navigate } from "react-router";
import { UserApp } from "./UserApp";
import AdminApp from "./admin/AdminApp";

export const router = createHashRouter([
  { path: "/", Component: UserApp },
  { path: "/admin/*", Component: AdminApp },
  { path: "/:screen", Component: UserApp },
  { path: "*", element: <Navigate to="/" replace /> },
]);

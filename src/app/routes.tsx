import { createHashRouter, Navigate } from "react-router";
import { UserApp } from "./UserApp";

export const router = createHashRouter([
  { path: "/", Component: UserApp },
  { path: "/:screen", Component: UserApp },
  { path: "/:screen/:id", Component: UserApp },
  { path: "*", element: <Navigate to="/" replace /> },
]);

import { Navigate } from "react-router-dom";

const NotFound = () => {
  return <Navigate to="/login" replace />;
};

export default NotFound;

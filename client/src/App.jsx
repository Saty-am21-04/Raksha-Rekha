import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes.jsx';

const App = () => (
  <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
);

export default App;
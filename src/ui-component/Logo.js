// material-ui
import { useTheme } from '@mui/material/styles';
import logoViae from 'assets/images/logo-viae.svg';

// ==============================|| LOGO ||============================== //

const Logo = () => {
    useTheme();
    return <img src={logoViae} alt="VIAE" style={{ height: 36 }} />;
};

export default Logo;

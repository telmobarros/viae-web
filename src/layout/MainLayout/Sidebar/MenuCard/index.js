import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

// material-ui
import { styled, useTheme } from '@mui/material/styles';
import {
    Avatar,
    Card,
    CardActionArea,
    CardContent,
    Grid,
    LinearProgress,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Typography,
    linearProgressClasses
} from '@mui/material';

// assets
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';

// project imports
import authAxios from 'utils/axios';

const STATUS_URL = 'http://localhost:5000/api/v1/solver/explorer/status';

// styles
const BorderLinearProgress = styled(LinearProgress)(({ theme }) => ({
    height: 10,
    borderRadius: 30,
    [`&.${linearProgressClasses.colorPrimary}`]: {
        backgroundColor: '#fff'
    },
    [`& .${linearProgressClasses.bar}`]: {
        borderRadius: 5,
        backgroundColor: theme.palette.primary.main
    }
}));

const CardStyle = styled(Card)(({ theme }) => ({
    background: theme.palette.primary.light,
    marginBottom: '22px',
    overflow: 'hidden',
    position: 'relative',
    '&:after': {
        content: '""',
        position: 'absolute',
        width: '157px',
        height: '157px',
        background: theme.palette.primary[200],
        borderRadius: '50%',
        top: '-105px',
        right: '-96px'
    }
}));

// ==============================|| STATUS BAR WITH LABEL ||============================== //

function ExplorationStatusRow({ running }) {
    const theme = useTheme();

    return (
        <Grid container direction="column" spacing={1} sx={{ mt: 1.5 }}>
            <Grid item>
                <Grid container justifyContent="space-between">
                    <Grid item>
                        <Typography variant="h6" sx={{ color: theme.palette.primary[800] }}>
                            Status
                        </Typography>
                    </Grid>
                    <Grid item>
                        <Typography variant="h6" color="inherit">
                            {running ? 'Running' : 'Idle'}
                        </Typography>
                    </Grid>
                </Grid>
            </Grid>
            <Grid item>
                {running ? <BorderLinearProgress variant="indeterminate" /> : <BorderLinearProgress variant="determinate" value={0} />}
            </Grid>
        </Grid>
    );
}

ExplorationStatusRow.propTypes = {
    running: PropTypes.bool
};

// ==============================|| SIDEBAR MENU Card ||============================== //

const MenuCard = () => {
    const theme = useTheme();
    const navigate = useNavigate();

    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const pollRef = useRef();

    const fetchStatus = useCallback(async () => {
        try {
            const res = await authAxios.get(STATUS_URL);
            setStatus(res.data);
            setError(false);
        } catch (e) {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    useEffect(() => {
        pollRef.current = setInterval(fetchStatus, status?.running ? 10000 : 30000);
        return () => clearInterval(pollRef.current);
    }, [status?.running, fetchStatus]);

    const running = Boolean(status?.running);
    const workers = status?.max_workers ?? 0;
    const completed = status?.coverage?.total_completed ?? 0;

    let secondaryText;
    if (loading) secondaryText = 'Checking status…';
    else if (error) secondaryText = 'Status unavailable';
    else if (running) secondaryText = `${workers} worker${workers === 1 ? '' : 's'} active`;
    else secondaryText = `${completed} run${completed === 1 ? '' : 's'} completed`;

    return (
        <CardStyle>
            <CardActionArea onClick={() => navigate('/admin/exploration')}>
                <CardContent sx={{ p: 2 }}>
                    <List sx={{ p: 0, m: 0 }}>
                        <ListItem alignItems="flex-start" disableGutters sx={{ p: 0 }}>
                            <ListItemAvatar sx={{ mt: 0 }}>
                                <Avatar
                                    variant="rounded"
                                    sx={{
                                        ...theme.typography.commonAvatar,
                                        ...theme.typography.largeAvatar,
                                        color: theme.palette.primary.main,
                                        border: 'none',
                                        borderColor: theme.palette.primary.main,
                                        background: '#fff',
                                        marginRight: '12px'
                                    }}
                                >
                                    <ScienceOutlinedIcon fontSize="inherit" />
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                sx={{ mt: 0 }}
                                primary={
                                    <Typography variant="subtitle1" sx={{ color: theme.palette.primary[800] }}>
                                        Exploration
                                    </Typography>
                                }
                                secondary={<Typography variant="caption">{secondaryText}</Typography>}
                            />
                        </ListItem>
                    </List>
                    <ExplorationStatusRow running={running} />
                </CardContent>
            </CardActionArea>
        </CardStyle>
    );
};

export default MenuCard;

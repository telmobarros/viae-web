import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import io from 'socket.io-client';

// material-ui
import { styled, useTheme } from '@mui/material/styles';
import {
    Avatar,
    Box,
    Card,
    CardActionArea,
    CardContent,
    Grid,
    IconButton,
    LinearProgress,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Menu,
    MenuItem,
    Typography,
    linearProgressClasses
} from '@mui/material';

// assets
import SensorsOutlinedIcon from '@mui/icons-material/SensorsOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

// project imports
import authAxios from 'utils/axios';
import { SET_INSTANCE } from 'store/actions';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const INSTANCES_URL = `${API_BASE}/api/live/instances`;

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

function LiveStatusRow({ live }) {
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
                            {live ? 'Live' : 'Idle'}
                        </Typography>
                    </Grid>
                </Grid>
            </Grid>
            <Grid item>
                {live ? <BorderLinearProgress variant="indeterminate" /> : <BorderLinearProgress variant="determinate" value={0} />}
            </Grid>
        </Grid>
    );
}

LiveStatusRow.propTypes = {
    live: PropTypes.bool
};

// ==============================|| SIDEBAR LIVE TRACKING CARD ||============================== //

const LiveStatusCard = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const socketRef = useRef(null);
    const pollRef = useRef();

    const fetchSummary = useCallback(async () => {
        try {
            const res = await authAxios.get(INSTANCES_URL);
            setSummary(res.data);
            setError(false);
        } catch (e) {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    useEffect(() => {
        pollRef.current = setInterval(fetchSummary, 30000);
        return () => clearInterval(pollRef.current);
    }, [fetchSummary]);

    useEffect(() => {
        socketRef.current = io(`${API_BASE}/live`, {
            transports: ['polling', 'websocket'],
            path: '/socket.io',
            reconnectionAttempts: 3
        });
        const socket = socketRef.current;
        socket.on('connect', () => socket.emit('join_live', { room: 'routes' }));
        socket.on('vehicle_update', fetchSummary);
        socket.on('total_screen_update', fetchSummary);
        return () => socket.disconnect();
    }, [fetchSummary]);

    const anyLive = Boolean(summary?.anyLive);
    const totalDeviceCount = summary?.totalDeviceCount ?? 0;
    const instances = summary?.instances ?? [];

    let secondaryText;
    if (loading) secondaryText = 'Checking status…';
    else if (error) secondaryText = 'Status unavailable';
    else if (anyLive) secondaryText = `${totalDeviceCount} device${totalDeviceCount === 1 ? '' : 's'} connected`;
    else secondaryText = 'No live solutions';

    const handleOpenMenu = (event) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = () => setAnchorEl(null);

    const handleSelectInstance = (item) => {
        setAnchorEl(null);
        dispatch({
            type: SET_INSTANCE,
            instance: {
                id: item.datasetInstanceId,
                name: item.datasetInstanceName,
                dataset: { name: item.datasetName }
            }
        });
        navigate('/live/solutions');
    };

    return (
        <CardStyle>
            <CardActionArea onClick={() => navigate('/live')}>
                <CardContent sx={{ p: 2 }}>
                    <Grid container alignItems="flex-start" justifyContent="space-between" wrap="nowrap">
                        <Grid item xs>
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
                                            <SensorsOutlinedIcon fontSize="inherit" />
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        sx={{ mt: 0 }}
                                        primary={
                                            <Typography variant="subtitle1" sx={{ color: theme.palette.primary[800] }}>
                                                Live Tracking
                                            </Typography>
                                        }
                                        secondary={<Typography variant="caption">{secondaryText}</Typography>}
                                    />
                                </ListItem>
                            </List>
                        </Grid>
                        {instances.length > 0 && (
                            <Grid item>
                                <IconButton size="small" onClick={handleOpenMenu} sx={{ color: theme.palette.primary.main }}>
                                    <KeyboardArrowDownIcon fontSize="small" />
                                </IconButton>
                            </Grid>
                        )}
                    </Grid>
                    <LiveStatusRow live={anyLive} />
                </CardContent>
            </CardActionArea>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}>
                {instances.map((item) => (
                    <MenuItem key={item.datasetInstanceId} onClick={() => handleSelectInstance(item)}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2">{item.datasetInstanceName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                                {item.datasetName} · {item.deviceCount} device{item.deviceCount === 1 ? '' : 's'}
                            </Typography>
                        </Box>
                    </MenuItem>
                ))}
            </Menu>
        </CardStyle>
    );
};

export default LiveStatusCard;

import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Link,
    Stack,
    Tooltip,
    Typography
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

import { SET_INSTANCE } from 'store/actions';
import authAxios from 'utils/axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * A dataset-instance name that doubles as a way to switch the app-wide
 * selection to that instance.
 *
 * Lists can show rows belonging to a dataset instance other than the selected
 * one (the solver-executions grid does exactly that under "All problem
 * instances"), and switching used to mean walking back up to the header
 * selector and hunting the instance down in the dialog. Clicking the name here
 * asks for confirmation first -- the selection scopes every page, so it is not
 * something to change by a stray click -- and then dispatches the same
 * SET_INSTANCE action the header selector uses.
 *
 * Props:
 *   instance  {id, name, dataset?} -- typically the `datasetInstance` summary
 *             a list row already carries.
 *   label     optional text override (defaults to the instance name).
 *   onSwitched(instance) optional callback after a successful switch.
 */
const DatasetInstanceLink = ({ instance, label, onSwitched }) => {
    const dispatch = useDispatch();
    const selected = useSelector((state) => state.instance.instance);
    const [open, setOpen] = useState(false);
    const [switching, setSwitching] = useState(false);
    const [error, setError] = useState(null);

    const text = label || instance?.name || (instance?.id ? `Instance ${instance.id}` : '—');

    const handleSwitch = async () => {
        setSwitching(true);
        setError(null);
        try {
            // The header selector puts the *full* DatasetInstance record into
            // the store, so fetch the canonical record instead of promoting the
            // trimmed summary a list row carries -- otherwise pages reading a
            // field the summary omits would silently see undefined. FAB returns
            // the id alongside `result`, not inside it, hence the explicit id.
            const res = await authAxios.get(`${API_BASE}/api/v1/dataset_instances/${instance.id}`);
            const full = res?.data?.result || {};
            dispatch({
                type: SET_INSTANCE,
                instance: {
                    ...full,
                    id: instance.id,
                    dataset: instance.dataset || full.dataset || (full.dataset_id ? { id: full.dataset_id } : undefined)
                }
            });
            setOpen(false);
            if (onSwitched) onSwitched(instance);
        } catch {
            setError('Could not load that dataset instance. It may have been removed.');
        } finally {
            setSwitching(false);
        }
    };

    if (!instance?.id) {
        return (
            <Typography variant="body2" color="text.secondary" noWrap>
                {text}
            </Typography>
        );
    }

    if (selected?.id === instance.id) {
        return (
            <Tooltip title="This is the dataset instance currently selected">
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
                    <CheckCircleOutlineIcon color="success" sx={{ fontSize: 14 }} />
                    <Typography variant="body2" noWrap>
                        {text}
                    </Typography>
                </Stack>
            </Tooltip>
        );
    }

    return (
        <>
            <Tooltip title="Not the instance you are currently working on — click to switch to it">
                <Link
                    component="button"
                    type="button"
                    variant="body2"
                    underline="hover"
                    noWrap
                    onClick={(e) => {
                        e.stopPropagation();
                        setOpen(true);
                    }}
                    sx={{ textAlign: 'left', maxWidth: '100%' }}
                >
                    {text}
                </Link>
            </Tooltip>
            <Dialog
                open={open}
                onClose={() => (switching ? null : setOpen(false))}
                maxWidth="xs"
                fullWidth
                onClick={(e) => e.stopPropagation()}
            >
                <DialogTitle>Change the dataset instance you are looking at?</DialogTitle>
                <DialogContent>
                    <DialogContentText component="div">
                        Viae scopes the whole dashboard to one dataset instance at a time. Switching to <strong>{text}</strong>
                        {instance.dataset?.name ? (
                            <>
                                {' '}
                                (dataset <strong>{instance.dataset.name}</strong>)
                            </>
                        ) : null}{' '}
                        changes what every page shows — the home node map, problem instances, solver executions and live tracking — and this
                        page reloads its rows and filters for the new instance.
                        <Typography variant="body2" sx={{ mt: 1.5 }}>
                            Currently selected: <strong>{selected?.name || 'none'}</strong>
                        </Typography>
                    </DialogContentText>
                    {error && (
                        <Typography color="error" variant="body2" sx={{ mt: 1.5 }}>
                            {error}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpen(false)} disabled={switching}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSwitch}
                        disabled={switching}
                        startIcon={switching ? <CircularProgress size={14} color="inherit" /> : <SwapHorizIcon />}
                    >
                        Switch instance
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default DatasetInstanceLink;

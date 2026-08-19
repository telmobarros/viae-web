/**
 * Compact dataset-instance selector for the admin AppBar.
 *
 * The main site's <SelectInstanceSection> was reused here at first, but its
 * Chip is sized for the Berry header — tall, with a stacked label and its own
 * padding — and inside react-admin's dense toolbar it grew the AppBar enough
 * to push the sidebar out of view. The genuinely reusable part is the picker
 * dialog, not the Berry chrome, so this reuses <SelectInstanceDialog> and the
 * same SET_INSTANCE action while rendering a toolbar-sized control.
 *
 * The selection is the same Redux state (persisted, one key), so choosing an
 * instance here and on the main site are the same act.
 */
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Button, Tooltip, Typography } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';

import { SET_INSTANCE } from 'store/actions';
import SelectInstanceDialog from 'layout/MainLayout/Header/SelectInstanceSection/SelectInstanceDialog';

const AdminInstanceSelector = () => {
    const dispatch = useDispatch();
    const selectedInstance = useSelector((state) => state.instance.instance);
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleSelectInstance = (instance) => {
        dispatch({ type: SET_INSTANCE, instance });
        setDialogOpen(false);
        // Deliberately no navigation: the main header sends you to '/', which
        // would eject you from the admin every time you switched instance.
    };

    const label = selectedInstance?.name || 'Select instance';

    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title={selectedInstance ? `Dataset: ${selectedInstance?.dataset?.name || '—'}` : 'No dataset instance selected'}>
                <Button
                    size="small"
                    color="inherit"
                    startIcon={<StorageIcon fontSize="small" />}
                    onClick={() => setDialogOpen(true)}
                    sx={{
                        textTransform: 'none',
                        maxWidth: 260,
                        // The name can be long; clip rather than let the
                        // toolbar grow and squeeze the sidebar.
                        '& .MuiButton-label, & span': { overflow: 'hidden' }
                    }}
                >
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {label}
                    </Typography>
                </Button>
            </Tooltip>
            <SelectInstanceDialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} onSelectInstance={handleSelectInstance} />
        </Box>
    );
};

export default AdminInstanceSelector;

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import { Chip, Box, Typography, Modal, Button, List, ListItemButton, ListItemText, Tooltip } from '@mui/material';
import { IconCpu2 } from '@tabler/icons';

import { SET_INSTANCE } from 'store/actions';

import SelectInstanceDialog from './SelectInstanceDialog';

const SelectInstanceSection = () => {
    const theme = useTheme();
    const dispatch = useDispatch();

    const selectedInstance = useSelector((state) => state.instance.instance);
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleOpenDialog = () => setDialogOpen(true);
    const handleCloseDialog = () => setDialogOpen(false);

    const handleSelectInstance = (instance) => {
        console.log('Selected Instance:', instance);
        dispatch({ type: SET_INSTANCE, instance: instance });
        setDialogOpen(false);
    };

    return (
        <>
            <Chip
                sx={{
                    padding: '8px !important',
                    height: 'auto',
                    alignItems: 'center',
                    borderRadius: '27px',
                    transition: 'all .2s ease-in-out',
                    borderColor: theme.palette.primary.light,
                    backgroundColor: theme.palette.primary.light,
                    '&[aria-controls="menu-list-grow"], &:hover': {
                        cursor: 'default'
                    },
                    '& .MuiChip-label': {
                        lineHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }
                }}
                icon={
                    <IconCpu2
                        stroke={1.5}
                        size="1.5rem"
                        color={theme.palette.primary.main}
                        sx={{
                            margin: '8px 0 8px 8px !important'
                        }}
                    />
                }
                label={
                    <>
                        {selectedInstance && selectedInstance.hasOwnProperty('id') && (
                            <Tooltip title={selectedInstance.dataset.name}>
                                <Typography variant="h5" color={theme.palette.primary.main}>
                                    {selectedInstance.name}
                                </Typography>
                            </Tooltip>
                        )}
                        <Button onClick={handleOpenDialog} variant="text" sx={{ padding: 0 }}>
                            <Typography variant="subtitle2" color={theme.palette.primary[800]} sx={{ textDecoration: 'underline' }}>
                                {selectedInstance && selectedInstance.hasOwnProperty('name') ? 'Change Instance' : 'Select Instance'}
                            </Typography>
                        </Button>
                    </>
                }
                variant="outlined"
                color="primary"
            />
            <SelectInstanceDialog isOpen={dialogOpen} onClose={handleCloseDialog} onSelectInstance={handleSelectInstance} />
        </>
    );
};

export default SelectInstanceSection;

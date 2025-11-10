import PropTypes from 'prop-types';
import { useTheme, styled } from '@mui/material/styles';
import { Avatar, Box, List, ListItem, ListItemAvatar, ListItemText, Tooltip, Typography } from '@mui/material';
import MainCard from 'ui-component/cards/MainCard';
import TotalIncomeCard from 'ui-component/cards/Skeleton/TotalIncomeCard'; // Use a more generic skeleton

const CardWrapper = styled(MainCard)(({ theme, backgroundColor, bgEffectColor }) => ({
    backgroundColor: backgroundColor || theme.palette.background.paper,
    overflow: 'hidden',
    position: 'relative',
    '&:after': {
        content: '""',
        position: 'absolute',
        width: 210,
        height: 210,
        background: `linear-gradient(210.04deg, ${bgEffectColor || theme.palette.primary.main} -50.94%, rgba(144, 202, 249, 0) 83.49%)`,
        borderRadius: '50%',
        top: -30,
        right: -180
    },
    '&:before': {
        content: '""',
        position: 'absolute',
        width: 210,
        height: 210,
        background: `linear-gradient(140.9deg, ${bgEffectColor || theme.palette.primary.main} -14.02%, rgba(144, 202, 249, 0) 70.50%)`,
        borderRadius: '50%',
        top: -160,
        right: -130
    }
}));

const GenericCard = ({
    isLoading,
    backgroundColor,
    bgEffectColor,
    avatarIcon,
    avatarColor,
    avatarBg,
    primaryText,
    primaryColor,
    secondaryText,
    secondaryColor
}) => {
    const theme = useTheme();

    // Default value for primaryText
    if (primaryText === undefined || primaryText === null || primaryText === '') {
        primaryText = 'N/D';
    }

    // Convert to number if it is the case
    if (!isNaN(Number(primaryText))) {
        primaryText = Number(primaryText);
    }

    return (
        <>
            {isLoading ? (
                <TotalIncomeCard />
            ) : (
                <CardWrapper backgroundColor={backgroundColor} bgEffectColor={bgEffectColor} border={false} content={false} elevation={1}>
                    <Box sx={{ p: 2 }}>
                        <List sx={{ py: 0 }}>
                            <ListItem alignItems="center" disableGutters sx={{ py: 0 }}>
                                <ListItemAvatar>
                                    <Avatar
                                        variant="rounded"
                                        sx={{
                                            ...theme.typography.commonAvatar,
                                            ...theme.typography.largeAvatar,
                                            backgroundColor: avatarBg || theme.palette.primary.main,
                                            color: avatarColor || theme.palette.getContrastText(avatarBg || theme.palette.primary.main)
                                        }}
                                    >
                                        {avatarIcon}
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    sx={{ py: 0, mt: 0.45, mb: 0.45 }}
                                    primary={
                                        <Tooltip title={typeof primaryText === 'number' ? primaryText : ''}>
                                            <Typography variant="h4" sx={{ color: primaryColor || 'inherit' }}>
                                                {typeof primaryText === 'number' && !Number.isInteger(primaryText)
                                                    ? primaryText.toFixed(2)
                                                    : primaryText}
                                            </Typography>
                                        </Tooltip>
                                    }
                                    secondary={
                                        <Typography variant="subtitle2" sx={{ color: secondaryColor || theme.palette.grey[500], mt: 0.5 }}>
                                            {secondaryText}
                                        </Typography>
                                    }
                                />
                            </ListItem>
                        </List>
                    </Box>
                </CardWrapper>
            )}
        </>
    );
};

GenericCard.propTypes = {
    isLoading: PropTypes.bool,
    backgroundColor: PropTypes.string,
    afterBg: PropTypes.string,
    beforeBg: PropTypes.string,
    avatarIcon: PropTypes.node.isRequired,
    avatarColor: PropTypes.string,
    avatarBg: PropTypes.string,
    primaryText: PropTypes.string.isRequired,
    primaryColor: PropTypes.string,
    secondaryText: PropTypes.string,
    secondaryColor: PropTypes.string
};

export default GenericCard;

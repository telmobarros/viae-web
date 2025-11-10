/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import React, { useState, useEffect } from 'react';
import { makeStyles } from '@mui/styles';
import { Alert, Button, Menu, MenuItem, Stack, Table, TableBody, TableCell, TableRow, TextField } from '@mui/material';
import { check } from 'prettier';

const useStyles = makeStyles({
    table: {
        margin: 'auto',
        marginTop: 20,
        borderCollapse: 'separate',
        borderSpacing: '4px',
        width: 'fit-content'
    },
    input: {
        marginRight: 20
    },
    button: {
        margin: 20,
        display: 'inline'
    },
    cell: {
        backgroundColor: 'lightgrey',
        borderRadius: '10px',
        padding: '10px',
        borderBottomWidth: '0',
        textAlign: 'center',
        width: '70px',
        height: '70px'
    }
});

class RiskLevel {
    constructor(name, level, color) {
        this.name = name;
        this.level = level;
        this.color = color;
    }
}
const RiskLevelPicker = ({ riskLevels, selectedRiskLevel, onSelectRiskLevel }) => {
    return (
        <div>
            {riskLevels.map((rl, index) => (
                <div
                    key={index}
                    style={{
                        backgroundColor: rl.color,
                        width: '20px',
                        height: '20px',
                        margin: '2px',
                        cursor: 'pointer',
                        border: selectedRiskLevel === rl ? '3px solid black' : 'none'
                    }}
                    onClick={() => onSelectRiskLevel(rl)}
                />
            ))}
        </div>
    );
};

const PixelArtApp = () => {
    const [grid, setGrid] = useState(() => Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => 'white')));
    const [isDrawing, setIsDrawing] = useState(false);

    const changeColor = (row, col, color) => {
        const newGrid = [...grid];
        newGrid[row][col] = color;
        setGrid(newGrid);
    };

    const handleMouseDown = (event, row, col) => {
        event.preventDefault();
        setIsDrawing(true);
        changeColor(row, col, 'black');
    };

    const handleMouseEnter = (event, row, col) => {
        if (isDrawing) {
            event.preventDefault();
            changeColor(row, col, 'black');
        }
    };

    const handleMouseUp = () => {
        setIsDrawing(false);
    };

    return (
        <div>
            <table onMouseUp={handleMouseUp}>
                <tbody>
                    {grid.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {row.map((cell, colIndex) => (
                                <td
                                    key={colIndex}
                                    style={{ backgroundColor: cell }}
                                    onMouseDown={(event) => handleMouseDown(event, rowIndex, colIndex)}
                                    onMouseEnter={(event) => handleMouseEnter(event, rowIndex, colIndex)}
                                />
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const Grid = () => {
    const classes = useStyles();
    const [rows, setRows] = useState(3);
    const [columns, setColumns] = useState(3);
    const [grid, setGrid] = useState([[]]);
    const [riskLevels, setRiskLevels] = useState([
        new RiskLevel('Baixo', 1, '#93d150'),
        new RiskLevel('Moderado', 2, '#ffff00'),
        new RiskLevel('Elevado', 3, '#f00')
    ]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [selectedRiskLevel, setSelectedRiskLevel] = useState(riskLevels[0]);
    const [inconsistencies, setInconcistencies] = useState(null);

    const [anchorEl, setAnchorEl] = React.useState(null);
    const open = Boolean(anchorEl);
    const handleClick = (event) => {
        console.log(event);
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const checkInconsistencies = () => {
        // Check rows
        for (let i = 0; i < grid.length; i++) {
            for (let j = 1; j < grid[0].length; j++) {
                if (grid[i][j].level < grid[i][j - 1].level) {
                    setInconcistencies(`linha ${i + 1}`);
                    return true;
                }
            }
        }

        // Check columns
        for (let j = 0; j < grid[0].length; j++) {
            for (let i = 1; i < grid.length; i++) {
                if (grid[i][j].level > grid[i - 1][j].level) {
                    setInconcistencies(`coluna ${j + 1}`);
                    return true;
                }
            }
        }

        setInconcistencies(null);
        return false;
    };

    const changeRiskLevel = (row, col, riskLevel) => {
        const newGrid = [...grid];
        newGrid[row][col] = riskLevel;
        setGrid(newGrid);
    };

    const handleMouseDown = (event, row, col) => {
        event.preventDefault();
        setIsDrawing(true);
        changeRiskLevel(row, col, selectedRiskLevel);
    };

    const handleMouseEnter = (event, row, col) => {
        if (isDrawing) {
            event.preventDefault();
            changeRiskLevel(row, col, selectedRiskLevel);
        }
    };

    const handleMouseUp = () => {
        setIsDrawing(false);
    };

    const handleSelectRiskLevel = (riskLevel) => {
        setSelectedRiskLevel(riskLevel);
    };

    useEffect(() => {
        checkInconsistencies();
    }, [grid]);

    useEffect(() => {
        let newGrid = [];
        for (let i = 0; i < rows; i++) {
            let row = [];
            for (let j = 0; j < columns; j++) {
                row.push(riskLevels[0]);
            }
            newGrid.push(row);
        }
        setGrid(newGrid);
    }, [rows, columns]);

    const handleRowChange = (newValue) => {
        newValue = parseInt(newValue);
        if (newValue >= 1) {
            setRows(newValue);
        }
    };

    const handleColumnChange = (newValue) => {
        newValue = parseInt(newValue);
        if (newValue >= 1) {
            setColumns(newValue);
        }
    };

    return (
        <div>
            <TextField
                label="Rows"
                type="number"
                value={rows}
                onChange={(e) => handleRowChange(e.target.value)}
                className={classes.input}
            />
            <TextField
                label="Columns"
                type="number"
                value={columns}
                onChange={(e) => handleColumnChange(e.target.value)}
                className={classes.input}
            />
            <div className={classes.button}>
                <Button variant="contained" color="primary" onClick={() => handleRowChange(parseInt(rows) + 1)}>
                    +1 Row
                </Button>
            </div>
            <div className={classes.button}>
                <Button variant="contained" color="primary" onClick={() => handleRowChange(parseInt(rows) - 1)}>
                    -1 Row
                </Button>
            </div>
            <div className={classes.button}>
                <Button variant="contained" color="primary" onClick={() => handleColumnChange(parseInt(columns) + 1)}>
                    +1 Column
                </Button>
            </div>
            <div className={classes.button}>
                <Button variant="contained" color="primary" onClick={() => handleColumnChange(parseInt(columns) - 1)}>
                    -1 Column
                </Button>
            </div>
            <Table className={classes.table} onMouseUp={handleMouseUp}>
                <TableBody>
                    {grid.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                            {row.map((cell, colIndex) => (
                                <TableCell
                                    key={colIndex}
                                    className={classes.cell}
                                    style={{ backgroundColor: cell.color }}
                                    onMouseDown={(event) => handleMouseDown(event, rowIndex, colIndex)}
                                    onMouseEnter={(event) => handleMouseEnter(event, rowIndex, colIndex)}
                                >
                                    <Button
                                        id="basic-button"
                                        aria-controls={open ? 'basic-menu' : undefined}
                                        aria-haspopup="true"
                                        aria-expanded={open ? 'true' : undefined}
                                        onClick={handleClick}
                                    >
                                        {cell.name}
                                    </Button>
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <Menu
                id="basic-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                MenuListProps={{
                    'aria-labelledby': 'basic-button'
                }}
            >
                <MenuItem onClick={handleClose}>Baixo</MenuItem>
                <MenuItem onClick={handleClose}>Médio</MenuItem>
                <MenuItem onClick={handleClose}>Grave</MenuItem>
            </Menu>
            <RiskLevelPicker riskLevels={riskLevels} selectedRiskLevel={selectedRiskLevel} onSelectRiskLevel={handleSelectRiskLevel} />
            {inconsistencies && (
                <Alert severity="error" style={{ marginBottom: 20 }}>
                    Atenção! Níveis de risco inconsistentes na {inconsistencies}
                </Alert>
            )}
        </div>
    );
};

export default Grid;

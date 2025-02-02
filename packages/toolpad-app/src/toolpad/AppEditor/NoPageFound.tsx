import { Grid, Typography, Button } from '@mui/material';
import * as React from 'react';
import useBoolean from '../../utils/useBoolean';
import CreatePageNodeDialog from './HierarchyExplorer/CreatePageNodeDialog';

export interface NoPageFoundProps {
  appId: string;
}
export default function NoPageFound({ appId }: NoPageFoundProps) {
  const {
    value: createPageDialogOpen,
    setTrue: handleCreatePageDialogOpen,
    setFalse: handleCreatepageDialogClose,
  } = useBoolean(false);

  return (
    <Grid
      container
      sx={{ minHeight: '100%', m: 1 }}
      spacing={1}
      justifyContent="center"
      alignItems="center"
      direction="column"
    >
      <Grid item>
        <Typography variant="h6">No pages in this app.</Typography>
      </Grid>
      <Grid item>
        <Button variant="outlined" color="inherit" onClick={handleCreatePageDialogOpen}>
          Create new
        </Button>
      </Grid>
      <CreatePageNodeDialog
        appId={appId}
        open={!!createPageDialogOpen}
        onClose={handleCreatepageDialogClose}
      />
    </Grid>
  );
}

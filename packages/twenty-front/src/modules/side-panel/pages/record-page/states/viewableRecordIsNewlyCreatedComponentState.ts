import { SidePanelPageComponentInstanceContext } from '@/side-panel/states/contexts/SidePanelPageComponentInstanceContext';
import { createAtomComponentState } from '@/ui/utilities/state/jotai/utils/createAtomComponentState';

export const viewableRecordIsNewlyCreatedComponentState =
  createAtomComponentState<boolean>({
    key: 'side-panel/viewable-record-is-newly-created',
    defaultValue: false,
    componentInstanceContext: SidePanelPageComponentInstanceContext,
  });

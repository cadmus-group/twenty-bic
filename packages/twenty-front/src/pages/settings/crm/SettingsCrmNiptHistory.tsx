import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { H2Title } from 'twenty-ui/display';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useQuery } from '@apollo/client/react';
import { GetCrmCallLogsDocument } from '~/generated/graphql';
import { CrmCallLogsTable } from './components/crm-call-logs-table.component';

const StyledSearchRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[3]};
  max-width: 560px;
`;

const StyledSearchInputContainer = styled.div`
  flex: 1;
  min-width: 200px;
`;

const StyledErrorMessage = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: ${themeCssVariables.spacing[3]} 0 0;
`;

const NIPT_SEARCH_INPUT_ID = 'settings-crm-nipt-history-search';

export const SettingsCrmNiptHistory = () => {
  const { t: tLingui } = useLingui();
  const [businessNiptDraft, setBusinessNiptDraft] = useState('');
  const [appliedBusinessNipt, setAppliedBusinessNipt] = useState('');

  const trimmedApplied = appliedBusinessNipt.trim();

  const { data, loading, error } = useQuery(GetCrmCallLogsDocument, {
    variables: {
      input: {
        businessNipt: trimmedApplied,
        limit: 100,
        offset: 0,
      },
    },
    skip: trimmedApplied.length === 0,
  });

  const logs = data?.crmCallLogs ?? [];

  const handleSearch = () => {
    setAppliedBusinessNipt(businessNiptDraft.trim());
  };

  return (
    <SubMenuTopBarContainer
      title={tLingui`NIPT history`}
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        { children: <Trans>NIPT history</Trans> },
      ]}
    >
      <SettingsPageContainer>
        <H2Title
          title={tLingui`NIPT history`}
          description={tLingui`Look up CRM call logs for a business by tax ID (NIPT).`}
        />
        <StyledSearchRow>
          <StyledSearchInputContainer>
            <SettingsTextInput
              instanceId={NIPT_SEARCH_INPUT_ID}
              placeholder={tLingui`Enter NIPT`}
              value={businessNiptDraft}
              onChange={(value) => setBusinessNiptDraft(value)}
              onInputEnter={handleSearch}
              fullWidth
            />
          </StyledSearchInputContainer>
          <Button title={tLingui`Search`} onClick={handleSearch} />
        </StyledSearchRow>
        {error != null ? (
          <StyledErrorMessage>
            <Trans>
              Could not load results. Check the ID and try again.
            </Trans>
          </StyledErrorMessage>
        ) : null}
        {trimmedApplied.length === 0 ? (
          <CrmCallLogsTable
            loading={false}
            logs={[]}
            emptyTitle={t`Search by NIPT`}
            emptySubtitle={t`Enter a business tax ID above, then press Search.`}
          />
        ) : (
          <CrmCallLogsTable
            loading={loading}
            logs={logs}
            emptyTitle={t`No CRM events for this NIPT`}
            emptySubtitle={t`Try another ID or confirm the business has logged activity.`}
          />
        )}
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};

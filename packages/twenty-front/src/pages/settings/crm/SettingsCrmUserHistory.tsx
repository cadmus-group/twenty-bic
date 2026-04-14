import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { H2Title } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useQuery } from '@apollo/client/react';
import { GetCrmMyCallLogsDocument } from '~/generated/graphql';
import { CrmCallLogsTable } from './components/crm-call-logs-table.component';

const StyledErrorMessage = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: ${themeCssVariables.spacing[3]} 0 0;
`;

export const SettingsCrmUserHistory = () => {
  const { t: tLingui } = useLingui();

  const { data, loading, error } = useQuery(GetCrmMyCallLogsDocument, {
    variables: {
      input: {
        limit: 100,
        offset: 0,
      },
    },
  });

  const logs = data?.crmMyCallLogs ?? [];

  return (
    <SubMenuTopBarContainer
      title={tLingui`User history`}
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        { children: <Trans>User history</Trans> },
      ]}
    >
      <SettingsPageContainer>
        <H2Title
          title={tLingui`User history`}
          description={tLingui`Calls and CRM events logged for your workspace member.`}
        />
        {error != null ? (
          <StyledErrorMessage>
            <Trans>
              Could not load history. Refresh the page or try again later.
            </Trans>
          </StyledErrorMessage>
        ) : null}
        <CrmCallLogsTable
          loading={loading}
          logs={logs}
          emptyTitle={t`No CRM events yet`}
          emptySubtitle={t`Your logged calls and interactions will show up here.`}
        />
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};

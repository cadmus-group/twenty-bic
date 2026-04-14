import { SettingsBillingLabelValueItem } from '@/settings/billing/components/internal/SettingsBillingLabelValueItem';
import { SubscriptionInfoContainer } from '@/settings/billing/components/SubscriptionInfoContainer';
import { useNumberFormat } from '@/localization/hooks/useNumberFormat';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath, isDefined } from 'twenty-shared/utils';
import { H2Title } from 'twenty-ui/display';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useQuery } from '@apollo/client/react';
import { GetCrmCallLogAnalyticsDocument } from '~/generated/graphql';

const StyledErrorMessage = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: ${themeCssVariables.spacing[3]} 0 0;
`;

const StyledMetrics = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  margin-top: ${themeCssVariables.spacing[4]};
  max-width: 440px;
`;

export const SettingsCrmAdminDashboard = () => {
  const { t: tLingui } = useLingui();
  const { formatNumber } = useNumberFormat();

  const { data, loading, error } = useQuery(GetCrmCallLogAnalyticsDocument, {
    variables: {},
  });

  const analytics = data?.crmCallLogAnalytics;

  const averageLabel = (() => {
    if (loading) {
      return '…';
    }
    if (!isDefined(analytics)) {
      return '—';
    }
    if (!isDefined(analytics.averageDurationInSeconds)) {
      return '—';
    }
    return `${formatNumber(analytics.averageDurationInSeconds, {
      decimals: 1,
    })} s`;
  })();

  return (
    <SubMenuTopBarContainer
      title={tLingui`Admin dashboard`}
      links={[
        {
          children: <Trans>Workspace</Trans>,
          href: getSettingsPath(SettingsPath.Workspace),
        },
        { children: <Trans>Admin dashboard</Trans> },
      ]}
    >
      <SettingsPageContainer>
        <H2Title
          title={tLingui`Admin dashboard`}
          description={tLingui`Workspace-wide call outcomes and volume (all members).`}
        />
        {error != null ? (
          <StyledErrorMessage>
            <Trans>
              Could not load analytics. You may need workspace settings access.
            </Trans>
          </StyledErrorMessage>
        ) : null}
        <Section>
          <StyledMetrics>
            <SubscriptionInfoContainer>
              <SettingsBillingLabelValueItem
                label={tLingui`Total calls`}
                value={
                  loading || !isDefined(analytics)
                    ? '…'
                    : formatNumber(analytics.totalCalls)
                }
                isValueInPrimaryColor
              />
              <SettingsBillingLabelValueItem
                label={tLingui`Answered`}
                value={
                  loading || !isDefined(analytics)
                    ? '…'
                    : formatNumber(analytics.answeredCalls)
                }
              />
              <SettingsBillingLabelValueItem
                label={tLingui`No answer`}
                value={
                  loading || !isDefined(analytics)
                    ? '…'
                    : formatNumber(analytics.noAnswerCalls)
                }
              />
              <SettingsBillingLabelValueItem
                label={tLingui`Busy`}
                value={
                  loading || !isDefined(analytics)
                    ? '…'
                    : formatNumber(analytics.busyCalls)
                }
              />
              <SettingsBillingLabelValueItem
                label={tLingui`Failed`}
                value={
                  loading || !isDefined(analytics)
                    ? '…'
                    : formatNumber(analytics.failedCalls)
                }
              />
              <SettingsBillingLabelValueItem
                label={tLingui`Canceled`}
                value={
                  loading || !isDefined(analytics)
                    ? '…'
                    : formatNumber(analytics.canceledCalls)
                }
              />
              <SettingsBillingLabelValueItem
                label={tLingui`Average duration`}
                value={averageLabel}
              />
            </SubscriptionInfoContainer>
          </StyledMetrics>
        </Section>
      </SettingsPageContainer>
    </SubMenuTopBarContainer>
  );
};

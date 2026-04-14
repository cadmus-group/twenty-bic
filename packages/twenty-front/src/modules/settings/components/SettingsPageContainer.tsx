import { OBJECT_SETTINGS_WIDTH } from '@/settings/data-model/constants/ObjectSettings';
import { useIsMobile } from '@/ui/utilities/responsive/hooks/useIsMobile';
import { ScrollWrapper } from '@/ui/utilities/scroll/components/ScrollWrapper';
import { useScrollRestoration } from '@/ui/utilities/scroll/hooks/useScrollRestoration';
import { styled } from '@linaria/react';
import { type ReactNode, useMemo } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath, isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledSettingsPageContainer = styled.div<{
  width?: number;
  isMobile?: boolean;
}>`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[8]};
  overflow: auto;
  padding: ${themeCssVariables.spacing[6]} ${themeCssVariables.spacing[8]}
    ${themeCssVariables.spacing[8]};
  padding-bottom: ${themeCssVariables.spacing[20]};
  width: ${({ width, isMobile }) => {
    if (isDefined(width)) {
      return width + 'px';
    }
    if (isMobile) {
      return 'unset';
    }
    return OBJECT_SETTINGS_WIDTH + 'px';
  }};
`;

export const SettingsPageContainer = ({
  children,
}: {
  children: ReactNode;
}) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const settingsPath = useMemo(() => {
    const values = Object.values(SettingsPath) as SettingsPath[];
    const exactMatch = values.find(
      (path) => getSettingsPath(path) === location.pathname,
    );
    if (isDefined(exactMatch)) {
      return exactMatch;
    }
    const sortedPaths = values.sort((a, b) => b.length - a.length);
    return sortedPaths.find((path) => {
      const pattern = getSettingsPath(path);
      return isDefined(matchPath(pattern, location.pathname));
    });
  }, [location.pathname]);

  const componentInstanceId = `scroll-wrapper-settings-page-container-${settingsPath ?? 'unknown'}`;

  useScrollRestoration(componentInstanceId);

  return (
    <ScrollWrapper componentInstanceId={componentInstanceId}>
      <StyledSettingsPageContainer isMobile={isMobile}>
        {children}
      </StyledSettingsPageContainer>
    </ScrollWrapper>
  );
};

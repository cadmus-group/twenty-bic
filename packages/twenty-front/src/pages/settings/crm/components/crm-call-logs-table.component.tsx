import { Table } from '@/ui/layout/table/components/Table';
import { TableCell } from '@/ui/layout/table/components/TableCell';
import { TableHeader } from '@/ui/layout/table/components/TableHeader';
import { TableRow } from '@/ui/layout/table/components/TableRow';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import Skeleton from 'react-loading-skeleton';
import { isDefined } from 'twenty-shared/utils';
import {
  AnimatedPlaceholder,
  AnimatedPlaceholderEmptyContainer,
  AnimatedPlaceholderEmptySubTitle,
  AnimatedPlaceholderEmptyTextContainer,
  AnimatedPlaceholderEmptyTitle,
} from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import type { CrmCallLogFieldsFragment } from '~/generated/graphql';
import { beautifyExactDateTime } from '~/utils/date-utils';

const StyledTableContainer = styled.div`
  margin-top: ${themeCssVariables.spacing[3]};
`;

const StyledHeaderRow = styled.div`
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

const GRID =
  'minmax(152px, 1fr) minmax(96px, 0.7fr) minmax(112px, 0.9fr) minmax(88px, 0.6fr) minmax(104px, 0.8fr) minmax(72px, 0.5fr) minmax(120px, 1fr)';

type CrmCallLogsTableProps = {
  loading: boolean;
  logs: CrmCallLogFieldsFragment[];
  emptyTitle: string;
  emptySubtitle: string;
};

const formatDuration = (seconds: number | null | undefined): string => {
  if (!isDefined(seconds)) {
    return '—';
  }
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
};

export const CrmCallLogsTable = ({
  loading,
  logs,
  emptyTitle,
  emptySubtitle,
}: CrmCallLogsTableProps) => {
  if (loading) {
    return (
      <StyledTableContainer>
        <Table>
          <StyledHeaderRow>
            <TableRow gridTemplateColumns={GRID}>
              <TableHeader>{t`When`}</TableHeader>
              <TableHeader>{t`Outcome`}</TableHeader>
              <TableHeader>{t`Event`}</TableHeader>
              <TableHeader>{t`NIPT`}</TableHeader>
              <TableHeader>{t`Phone`}</TableHeader>
              <TableHeader>{t`Duration`}</TableHeader>
              <TableHeader>{t`Notes`}</TableHeader>
            </TableRow>
          </StyledHeaderRow>
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton height={44} borderRadius={4} key={index} />
          ))}
        </Table>
      </StyledTableContainer>
    );
  }

  if (logs.length === 0) {
    return (
      <AnimatedPlaceholderEmptyContainer>
        <AnimatedPlaceholder type="emptyTimeline" />
        <AnimatedPlaceholderEmptyTextContainer>
          <AnimatedPlaceholderEmptyTitle>{emptyTitle}</AnimatedPlaceholderEmptyTitle>
          <AnimatedPlaceholderEmptySubTitle>
            {emptySubtitle}
          </AnimatedPlaceholderEmptySubTitle>
        </AnimatedPlaceholderEmptyTextContainer>
      </AnimatedPlaceholderEmptyContainer>
    );
  }

  return (
    <StyledTableContainer>
      <Table>
        <StyledHeaderRow>
          <TableRow gridTemplateColumns={GRID}>
            <TableHeader>{t`When`}</TableHeader>
            <TableHeader>{t`Outcome`}</TableHeader>
            <TableHeader>{t`Event`}</TableHeader>
            <TableHeader>{t`NIPT`}</TableHeader>
            <TableHeader>{t`Phone`}</TableHeader>
            <TableHeader>{t`Duration`}</TableHeader>
            <TableHeader>{t`Notes`}</TableHeader>
          </TableRow>
        </StyledHeaderRow>
        {logs.map((log) => (
          <TableRow key={log.id} gridTemplateColumns={GRID}>
            <TableCell color={themeCssVariables.font.color.tertiary}>
              {beautifyExactDateTime(log.calledAt)}
            </TableCell>
            <TableCell>{log.outcome.replaceAll('_', ' ')}</TableCell>
            <TableCell
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {log.historyEventType.replaceAll('_', ' ')}
            </TableCell>
            <TableCell
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {log.businessNipt ?? '—'}
            </TableCell>
            <TableCell
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {log.phoneNumber ?? '—'}
            </TableCell>
            <TableCell>
              {formatDuration(log.durationInSeconds ?? null)}
            </TableCell>
            <TableCell
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
              title={log.notes ?? undefined}
            >
              {log.notes?.trim() ? log.notes : '—'}
            </TableCell>
          </TableRow>
        ))}
      </Table>
    </StyledTableContainer>
  );
};

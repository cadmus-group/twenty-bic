import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useCreateOneFieldMetadataItem } from '@/object-metadata/hooks/useCreateOneFieldMetadataItem';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { recordCreationPendingNiptRecordIdState } from '@/object-record/record-show/states/recordCreationPendingNiptRecordIdState';
import { recordStoreFamilySelector } from '@/object-record/record-store/states/selectors/recordStoreFamilySelector';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { TextInput } from '@/ui/input/components/TextInput';
import { useLayoutRenderingContext } from '@/ui/layout/contexts/LayoutRenderingContext';
import { useAtomFamilySelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilySelectorValue';
import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { isNonEmptyString } from '@sniptt/guards';
import { useSetAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { FieldMetadataType } from '~/generated-metadata/graphql';

const StyledFormContainer = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[4]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledFormTitle = styled.h3`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

const StyledHint = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const StyledValidationError = styled.p`
  color: ${themeCssVariables.color.red};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const extractErrorText = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const isDuplicateError = (error: unknown): boolean => {
  const errorText = extractErrorText(error).toLowerCase();

  return (
    errorText.includes('duplicate') ||
    errorText.includes('unique') ||
    errorText.includes('already exists')
  );
};

export const BusinessNiptOnCreateSection = () => {
  const { targetRecordIdentifier } = useLayoutRenderingContext();
  const { objectMetadataItems } = useObjectMetadataItems();
  const { createOneFieldMetadataItem } = useCreateOneFieldMetadataItem();

  const setPendingNiptRecordId = useSetAtom(
    recordCreationPendingNiptRecordIdState,
  );

  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const { updateOneRecord } = useUpdateOneRecord();

  const recordId = targetRecordIdentifier?.id ?? '';
  const objectNameSingular =
    targetRecordIdentifier?.targetObjectNameSingular ?? '';

  const objectMetadataItem = objectMetadataItems.find(
    (metadataItem) => metadataItem.nameSingular === objectNameSingular,
  );

  const niptFieldMetadataItem = objectMetadataItem?.fields.find(
    (fieldMetadataItem) => {
      const normalizedLabel = fieldMetadataItem.label?.trim().toLowerCase();

      return (
        fieldMetadataItem.name === 'nipt' ||
        fieldMetadataItem.name === 'businessNipt' ||
        normalizedLabel === 'nipt'
      );
    },
  );

  const niptFieldName = niptFieldMetadataItem?.name;

  const savedNipt = useAtomFamilySelectorValue(recordStoreFamilySelector, {
    recordId,
    fieldName: niptFieldName ?? 'nipt',
  }) as string | null | undefined;

  const [draftNipt, setDraftNipt] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ensureNiptFieldName = useCallback(async (): Promise<string | null> => {
    if (isNonEmptyString(niptFieldName)) {
      return niptFieldName;
    }

    if (!isDefined(objectMetadataItem)) {
      return null;
    }

    const createFieldResult = await createOneFieldMetadataItem({
      objectMetadataId: objectMetadataItem.id,
      type: FieldMetadataType.TEXT,
      name: 'nipt',
      label: 'NIPT',
      isUnique: true,
      // Keep metadata nullable to avoid breaking existing records.
      // Form-level validation keeps NIPT mandatory when using this form.
      isNullable: true,
      isCustom: true,
      isActive: true,
    });

    if (createFieldResult.status === 'failed') {
      return null;
    }

    return 'nipt';
  }, [createOneFieldMetadataItem, niptFieldName, objectMetadataItem]);

  useEffect(() => {
    setDraftNipt(savedNipt ?? '');
    setValidationError(null);
  }, [recordId, savedNipt]);

  const submitNipt = useCallback(async () => {
    if (!isNonEmptyString(recordId) || !isNonEmptyString(objectNameSingular)) {
      return;
    }

    const trimmedDraft = draftNipt.trim();

    if (!isNonEmptyString(trimmedDraft)) {
      setValidationError(t`NIPT is required.`);
      enqueueErrorSnackBar({ message: t`NIPT is required.` });
      return;
    }

    const fieldNameToUpdate = await ensureNiptFieldName();

    if (!isNonEmptyString(fieldNameToUpdate)) {
      const message = t`Could not create or find the NIPT field on this object.`;
      setValidationError(message);
      enqueueErrorSnackBar({ message });
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);

    try {
      await updateOneRecord({
        objectNameSingular,
        idToUpdate: recordId,
        updateOneRecordInput: {
          [fieldNameToUpdate]: trimmedDraft,
        },
      });

      setPendingNiptRecordId(null);
      enqueueSuccessSnackBar({
        message: t`NIPT saved successfully.`,
      });
    } catch (error) {
      const backendErrorMessage = extractErrorText(error);
      const message = isDuplicateError(error)
        ? t`NIPT must be unique. This value already exists.`
        : isNonEmptyString(backendErrorMessage)
          ? backendErrorMessage
          : t`Could not save NIPT. Please enter a valid value and try again.`;

      setValidationError(message);
      enqueueErrorSnackBar({ message });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    draftNipt,
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    ensureNiptFieldName,
    objectNameSingular,
    recordId,
    setPendingNiptRecordId,
    updateOneRecord,
  ]);

  const isBusinessOrCompanyObject =
    objectNameSingular === 'business' || objectNameSingular === 'company';

  if (!isNonEmptyString(recordId) || !isBusinessOrCompanyObject) {
    return null;
  }

  return (
    <StyledFormContainer>
      <StyledFormTitle>
        <Trans>NIPT</Trans>
      </StyledFormTitle>
      <TextInput
        required
        label={t`NIPT`}
        placeholder={t`Enter business NIPT`}
        value={draftNipt}
        onChange={(text) => {
          setDraftNipt(text);
          if (validationError !== null) {
            setValidationError(null);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void submitNipt();
          }
        }}
        fullWidth
        sizeVariant="md"
      />
      {validationError !== null ? (
        <StyledValidationError>{validationError}</StyledValidationError>
      ) : null}
      <Button
        title={t`Submit`}
        onClick={() => {
          void submitNipt();
        }}
        isLoading={isSubmitting}
      />
      <StyledHint>
        <Trans>
          Submit saves NIPT to this company/business record.
        </Trans>
      </StyledHint>
    </StyledFormContainer>
  );
};

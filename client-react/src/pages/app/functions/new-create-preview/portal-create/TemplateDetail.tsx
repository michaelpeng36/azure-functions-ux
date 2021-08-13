import React, { useEffect, useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'office-ui-fabric-react';
import { FunctionTemplate } from '../../../../../models/functions/function-template';
import { getBindingDirection } from '../../function/integrate/FunctionIntegrate.utils';
import { FunctionInfo } from '../../../../../models/functions/function-info';
import { ArmObj } from '../../../../../models/arm-obj';
import { Binding } from '../../../../../models/functions/binding';
import FunctionsService from '../../../../../ApiHelpers/FunctionsService';
import LogService from '../../../../../utils/LogService';
import { LogCategories } from '../../../../../utils/LogCategories';
import { getErrorMessageOrStringify } from '../../../../../ApiHelpers/ArmHelper';
import FunctionCreateData from '../FunctionCreate.data';
import CreateFunctionFormBuilderFactory, { FunctionFormBuilder } from '../../common/CreateFunctionFormBuilderFactory';
import { CreateFunctionFormValues } from '../../common/CreateFunctionFormBuilder';
import { FormikProps } from 'formik';
import { detailContainerStyle } from '../FunctionCreate.styles';
import BasicShimmerLines from '../../../../../components/shimmer/BasicShimmerLines';
import { FunctionCreateContext } from '../FunctionCreateContext';
import { Links } from '../../../../../utils/FwLinks';
import { IArmRscTemplate, TSetArmResources } from '../FunctionCreateDataLoader';
import { PortalContext } from '../../../../../PortalContext';
import RbacConstants from '../../../../../utils/rbac-constants';

export interface TemplateDetailProps {
  resourceId: string;
  selectedTemplate: FunctionTemplate;
  formProps: FormikProps<CreateFunctionFormValues>;
  setBuilder: (builder?: FunctionFormBuilder) => void;
  builder?: FunctionFormBuilder;
  setArmResources: TSetArmResources;
  armResources: IArmRscTemplate[];
}

const TemplateDetail: React.FC<TemplateDetailProps> = props => {
  const { resourceId, selectedTemplate, formProps, builder, setBuilder, setArmResources, armResources } = props;
  const { t } = useTranslation();
  const portalCommunicator = useContext(PortalContext);

  const [functionsInfo, setFunctionsInfo] = useState<ArmObj<FunctionInfo>[] | undefined | null>(undefined);
  const [bindings, setBindings] = useState<Binding[] | undefined | null>(undefined);

  const functionCreateContext = useContext(FunctionCreateContext);

  const fetchFunctionInfo = async () => {
    const functionsInfoResponse = await FunctionsService.getFunctions(resourceId);

    if (functionsInfoResponse.metadata.success) {
      setFunctionsInfo(functionsInfoResponse.data.value);
    } else {
      setFunctionsInfo(null);
      LogService.trackEvent(
        LogCategories.localDevExperience,
        'getFunctionsInfo',
        `Failed to get functions info: ${getErrorMessageOrStringify(functionsInfoResponse.metadata.error)}`
      );
    }
  };

  const fetchBindings = async () => {
    const bindingIds = getRequiredBindingIds(selectedTemplate);
    const allBindings: Binding[] = [];
    for (const bindingId of bindingIds) {
      const bindingPromise = await FunctionCreateData.getBinding(resourceId, bindingId);
      if (bindingPromise.metadata.success) {
        allBindings.push(bindingPromise.data.properties[0]);
      } else {
        setBindings(null);
        LogService.trackEvent(
          LogCategories.localDevExperience,
          'getBindings',
          `Failed to get bindings: ${getErrorMessageOrStringify(bindingPromise.metadata.error)}`
        );
      }
    }
    setBindings(
      selectedTemplate.userPrompt && selectedTemplate.userPrompt.length > 0
        ? getRequiredCreationBindings(allBindings, selectedTemplate.userPrompt)
        : []
    );
  };

  const getRequiredBindingIds = (template: FunctionTemplate): string[] => {
    const requiredBindingIds: string[] = [];
    if (template.userPrompt && template.userPrompt.length > 0) {
      template.userPrompt.forEach(prompt => {
        if (template.bindings) {
          template.bindings.forEach(binding => {
            if (binding[prompt]) {
              const bindingDirection = getBindingDirection(binding);
              const bindingId = `${binding.type}-${bindingDirection}`;
              if (!requiredBindingIds.includes(bindingId)) {
                requiredBindingIds.push(bindingId);
              }
            }
          });
        }
      });
    }
    return requiredBindingIds;
  };

  // Not all bindings are required for function creation
  // Only display bindings that are list in the function template 'userPrompt'
  const getRequiredCreationBindings = (bindings: Binding[], userPrompt: string[]): Binding[] => {
    const requiredBindings: Binding[] = [];
    bindings.forEach(binding => {
      const requiredBinding = binding;
      requiredBinding.settings =
        binding.settings &&
        binding.settings.filter(setting => {
          return userPrompt.find(prompt => prompt === setting.name);
        });
      requiredBindings.push(requiredBinding);
    });
    return requiredBindings;
  };

  const createFactory = async () => {
    if (functionsInfo && bindings && !!resourceId) {
      let rscIdToCheck = resourceId.split('/providers')[0];
      const rscGrpWritePermission = await portalCommunicator.hasPermission(rscIdToCheck, [RbacConstants.writeScope]);
      rscIdToCheck = rscIdToCheck.split('/resourceGroups')[0];
      const subWritePermission = await portalCommunicator.hasPermission(rscIdToCheck, [RbacConstants.writeScope]);

      createBuilder(
        new CreateFunctionFormBuilderFactory(
          selectedTemplate.id,
          selectedTemplate.bindings || [],
          bindings,
          resourceId,
          functionsInfo,
          selectedTemplate.defaultFunctionName || 'NewFunction',
          rscGrpWritePermission,
          subWritePermission,
          t
        )
      );
    }
  };

  const createBuilder = (formBuilderFactory: CreateFunctionFormBuilderFactory) => {
    setBuilder(formBuilderFactory.formBuilder);
  };

  const getDetails = () => {
    return !functionsInfo || !bindings || !builder ? (
      <BasicShimmerLines />
    ) : (
      builder.getFields(formProps, setArmResources, armResources, !!functionCreateContext.creatingFunction)
    );
  };

  useEffect(() => {
    createFactory();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [functionsInfo, bindings]);

  useEffect(() => {
    setBindings(undefined);
    setBuilder(undefined);
    fetchBindings();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate]);

  useEffect(() => {
    fetchFunctionInfo();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return functionsInfo === null || bindings === null ? (
    <>{/** TODO(krmitta): Add banner when call fails */}</>
  ) : (
    <div className={detailContainerStyle}>
      <h3>{t('templateDetails')}</h3>
      <p>
        {t('detailDescription').format(selectedTemplate.name)}
        <Link href={Links.functionCreateBindingsLearnMore}>{t('learnMore')}</Link>
      </p>
      {getDetails()}
    </div>
  );
};

export default TemplateDetail;

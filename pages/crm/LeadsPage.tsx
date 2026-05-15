import React from "react";
import { useParams } from "react-router-dom";
import CRMLeads from "../CRMLeads";

const LeadsPage: React.FC = () => {
  const { leadId } = useParams<{ leadId?: string }>();
  return <CRMLeads initialLeadId={leadId} />;
};

export default LeadsPage;

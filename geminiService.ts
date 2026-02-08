
import { GoogleGenAI, Type } from "@google/genai";
import { CaseDetails, JudgementDraft, Party, PartyRole } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

/**
 * Extracts structured party information from unstructured text.
 */
export const extractPartyInfo = async (text: string): Promise<Party[]> => {
  const prompt = `
    你是一个专业的法律助手。请从以下文本中提取案件当事人的信息。
    文本内容：
    """
    ${text}
    """
    
    提取要求：
    1. 识别当事人角色（role）：原告(plaintiff)、被告(defendant)、第三人(third_party)、公诉机关(prosecutor)。
    2. 提取姓名/名称(name)、证件号/信用代码(identity)、地址(address)、联系电话(phone)、法定代表人(legalRep)、代理人(agent)。
    3. 如果某项缺失，留空。
    4. 输出为 JSON 数组。
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            role: { type: Type.STRING, enum: ['plaintiff', 'defendant', 'third_party', 'prosecutor'] },
            name: { type: Type.STRING },
            identity: { type: Type.STRING },
            address: { type: Type.STRING },
            phone: { type: Type.STRING },
            legalRep: { type: Type.STRING },
            agent: { type: Type.STRING }
          },
          required: ["role", "name"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text) as Party[];
  } catch (e) {
    console.error("Extraction failed", e);
    return [];
  }
};

export const generateJudgementDraft = async (details: CaseDetails): Promise<JudgementDraft> => {
  const formatParties = (parties: Party[]) => 
    parties.map(p => `${p.name} (身份/代码: ${p.identity || '未填写'}, 地址: ${p.address || '未填写'}${p.phone ? `, 电话: ${p.phone}` : ''})`).join('; ');

  const prompt = `
    你是一位资深的中国高级法官。请起草一份${details.caseType}判决书草案。
    
    【基本信息】
    法院：${details.courtName}
    案号：${details.caseNumber}
    
    【当事人】
    公诉机关：${formatParties(details.prosecutors)}
    原告：${formatParties(details.plaintiffs)}
    被告：${formatParties(details.defendants)}
    第三人：${formatParties(details.thirdParties)}
    
    【内容概要】
    请求/指控：${details.claims}
    查明事实：${details.facts}
    证据：${details.evidence}
    法律依据提示：${details.legalBasis}

    请按照规范格式输出 JSON。
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 4000 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          partiesSection: { type: Type.STRING },
          proceedings: { type: Type.STRING },
          claimsAndDefense: { type: Type.STRING },
          courtFindings: { type: Type.STRING },
          courtReasoning: { type: Type.STRING },
          judgment: { type: Type.STRING },
          closing: { type: Type.STRING }
        },
        required: ["title", "partiesSection", "proceedings", "claimsAndDefense", "courtFindings", "courtReasoning", "judgment", "closing"]
      }
    }
  });

  return JSON.parse(response.text) as JudgementDraft;
};

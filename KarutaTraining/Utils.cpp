#include "Utils.h"

using namespace System;
using namespace System::Collections::Generic;
using namespace System::Globalization;
using namespace System::Text::RegularExpressions;

namespace KarutaTraining {
    List<String^>^ KarutaUtils::ToChars(String^ input)
    {
        auto chars = gcnew List<String^>();
        if (String::IsNullOrEmpty(input)) return chars;
        auto enumerator = StringInfo::GetTextElementEnumerator(input);
        while (enumerator->MoveNext())
        {
            chars->Add(enumerator->GetTextElement());
        }
        return chars;
    }

    int KarutaUtils::LcpChars(String^ a, String^ b)
    {
        auto ca = ToChars(a);
        auto cb = ToChars(b);
        int n = Math::Min(ca->Count, cb->Count);
        int i = 0;
        while (i < n && String::Equals(ca[i], cb[i]))
        {
            i++;
        }
        return i;
    }

    String^ KarutaUtils::PrefixChars(String^ input, int count)
    {
        auto chars = ToChars(input);
        if (count > chars->Count) count = chars->Count;
        return String::Join(String::Empty, chars->GetRange(0, count));
    }

    bool KarutaUtils::HasHiragana(String^ input)
    {
        if (String::IsNullOrEmpty(input)) return false;
        return Regex::IsMatch(input, L"[\u3041-\u3096]");
    }

    bool KarutaUtils::HasAlphabet(String^ input)
    {
        if (String::IsNullOrEmpty(input)) return false;
        return Regex::IsMatch(input, L"[A-Za-z]");
    }

    bool KarutaUtils::IsAsciiOnly(String^ input)
    {
        if (String::IsNullOrEmpty(input)) return true;
        return Regex::IsMatch(input, L"^[\x20-\x7E]+$");
    }

    void KarutaUtils::Shuffle<T>(List<T>^ list, Random^ rng)
    {
        for (int i = list->Count - 1; i > 0; --i)
        {
            int j = rng->Next(i + 1);
            T tmp = list[i];
            list[i] = list[j];
            list[j] = tmp;
        }
    }

    String^ KarutaUtils::ComputeExpectedPrefix(int currentId, List<CardItem^>^ items, List<int>^ candidateIds)
    {
        String^ target = nullptr;
        for each (auto item in items)
        {
            if (item->Id == currentId)
            {
                target = item->Reading;
                break;
            }
        }
        if (String::IsNullOrEmpty(target)) return String::Empty;

        int maxLcp = 0;
        for each (int id in candidateIds)
        {
            if (id == currentId) continue;
            String^ other = nullptr;
            for each (auto item in items)
            {
                if (item->Id == id)
                {
                    other = item->Reading;
                    break;
                }
            }
            if (String::IsNullOrEmpty(other)) continue;
            int l = LcpChars(target, other);
            if (l > maxLcp) maxLcp = l;
        }
        int need = Math::Min(ToChars(target)->Count, maxLcp + 1);
        return PrefixChars(target, need);
    }

    String^ KarutaUtils::RomajiToHiraganaStrict(String^ input, Dictionary<String^, String^>^ vowels, Dictionary<String^, array<String^>^>^ consonants)
    {
        if (String::IsNullOrEmpty(input)) return String::Empty;
        String^ s = input->Trim()->ToLowerInvariant();
        s = Regex::Replace(s, L"\s+", String::Empty);
        if (!IsAsciiOnly(s)) return nullptr;

        int i = 0;
        String^ out = String::Empty;
        while (i < s->Length)
        {
            if (s->Substring(i)->StartsWith("ooke")) { out += "おおけ"; i += 4; continue; }
            if (s->Substring(i)->StartsWith("ooko")) { out += "おおこ"; i += 4; continue; }
            if (s->Substring(i)->StartsWith("ooe")) { out += "おおえ"; i += 3; continue; }

            if (s->Substring(i)->StartsWith("shi")) { out += "し"; i += 3; continue; }
            if (s->Substring(i)->StartsWith("chi")) { out += "ち"; i += 3; continue; }
            if (s->Substring(i)->StartsWith("tsu")) { out += "つ"; i += 3; continue; }

            if (s->Substring(i)->StartsWith("si")) { out += "し"; i += 2; continue; }
            if (s->Substring(i)->StartsWith("ti")) { out += "ち"; i += 2; continue; }
            if (s->Substring(i)->StartsWith("tu")) { out += "つ"; i += 2; continue; }
            if (s->Substring(i)->StartsWith("hu")) { out += "ふ"; i += 2; continue; }
            if (s->Substring(i)->StartsWith("fu")) { out += "ふ"; i += 2; continue; }
            if (s->Substring(i)->StartsWith("ji")) { out += "じ"; i += 2; continue; }
            if (s->Substring(i)->StartsWith("zi")) { out += "じ"; i += 2; continue; }

            String^ ch = s->Substring(i, 1);
            String^ ch2 = (i + 1 < s->Length) ? s->Substring(i, 2) : String::Empty;
            if (vowels != nullptr && vowels->ContainsKey(ch))
            {
                out += vowels[ch];
                i += 1;
                continue;
            }

            if (!String::IsNullOrEmpty(ch2) && consonants != nullptr && consonants->ContainsKey(ch) && vowels != nullptr)
            {
                String^ vowelKey = ch2->Substring(1, 1);
                if (vowels->ContainsKey(vowelKey))
                {
                    int vowelIndex = String::Format("aiueo")->IndexOf(vowelKey);
                    auto row = consonants[ch];
                    if (vowelIndex >= 0 && vowelIndex < row->Length)
                    {
                        String^ kana = row[vowelIndex];
                        if (!String::IsNullOrEmpty(kana))
                        {
                            out += kana;
                            i += 2;
                            continue;
                        }
                    }
                }
            }
            return nullptr;
        }
        return out;
    }
}

#include "DataStore.h"

using namespace System;
using namespace System::Collections::Generic;
using namespace System::IO;
using namespace System::Web::Script::Serialization;

namespace KarutaTraining {
    static JavaScriptSerializer^ CreateSerializer()
    {
        auto serializer = gcnew JavaScriptSerializer();
        serializer->MaxJsonLength = Int32::MaxValue;
        return serializer;
    }

    Dictionary<String^, String^>^ DataStore::LoadCardImages(String^ baseDir)
    {
        String^ path = Path::Combine(baseDir, "cards-data.json");
        auto map = gcnew Dictionary<String^, String^>();
        if (!File::Exists(path)) return map;

        String^ json = File::ReadAllText(path);
        auto serializer = CreateSerializer();
        auto result = safe_cast<Dictionary<String^, Object^>^>(serializer->DeserializeObject(json));
        for each (auto kv in result)
        {
            map[kv.Key] = kv.Value != nullptr ? kv.Value->ToString() : String::Empty;
        }
        return map;
    }

    KimarijiData^ DataStore::LoadKimarijiData(String^ baseDir)
    {
        String^ path = Path::Combine(baseDir, "kimariji-data.json");
        auto data = gcnew KimarijiData();
        data->Items = gcnew List<CardItem^>();
        data->RomajiConsonant = gcnew Dictionary<String^, array<String^>^>();
        data->RomajiVowels = gcnew Dictionary<String^, String^>();

        if (!File::Exists(path)) return data;

        String^ json = File::ReadAllText(path);
        auto serializer = CreateSerializer();
        auto result = safe_cast<Dictionary<String^, Object^>^>(serializer->DeserializeObject(json));

        if (result->ContainsKey("items"))
        {
            auto items = safe_cast<System::Collections::ArrayList^>(result["items"]);
            for each (auto itemObj in items)
            {
                auto itemDict = safe_cast<Dictionary<String^, Object^>^>(itemObj);
                auto item = gcnew CardItem();
                item->Id = Convert::ToInt32(itemDict["id"]);
                item->Reading = itemDict["s"]->ToString();
                data->Items->Add(item);
            }
        }

        if (result->ContainsKey("romajiVowels"))
        {
            auto vowels = safe_cast<Dictionary<String^, Object^>^>(result["romajiVowels"]);
            for each (auto kv in vowels)
            {
                data->RomajiVowels[kv.Key] = kv.Value->ToString();
            }
        }

        if (result->ContainsKey("romajiConsonant"))
        {
            auto consonant = safe_cast<Dictionary<String^, Object^>^>(result["romajiConsonant"]);
            for each (auto kv in consonant)
            {
                auto list = safe_cast<System::Collections::ArrayList^>(kv.Value);
                auto arr = gcnew array<String^>(list->Count);
                for (int i = 0; i < list->Count; ++i)
                {
                    arr[i] = list[i] != nullptr ? list[i]->ToString() : String::Empty;
                }
                data->RomajiConsonant[kv.Key] = arr;
            }
        }

        return data;
    }

    AppSettings^ DataStore::LoadSettings(String^ baseDir)
    {
        String^ path = Path::Combine(baseDir, "settings.json");
        auto settings = gcnew AppSettings();
        settings->Common = gcnew CommonSettings();
        settings->FudaNagashi = gcnew FudaNagashiSettings();

        settings->Common->AllOrPart = false;
        settings->Common->SelectedIds = gcnew List<int>();
        settings->Common->NoneCards = gcnew array<bool>(6 * 11);

        settings->FudaNagashi->Direction = "normal";
        settings->FudaNagashi->JudgeByRomaji = true;
        settings->FudaNagashi->Changing = true;
        settings->FudaNagashi->AutoAdvance = false;
        settings->FudaNagashi->WaitMs = 0;
        settings->FudaNagashi->Count = 100;

        if (!File::Exists(path)) return settings;

        String^ json = File::ReadAllText(path);
        auto serializer = CreateSerializer();
        auto result = safe_cast<Dictionary<String^, Object^>^>(serializer->DeserializeObject(json));

        if (result->ContainsKey("common"))
        {
            auto common = safe_cast<Dictionary<String^, Object^>^>(result["common"]);
            if (common->ContainsKey("allOrPart")) settings->Common->AllOrPart = Convert::ToBoolean(common["allOrPart"]);
            if (common->ContainsKey("selectedIds"))
            {
                auto ids = safe_cast<System::Collections::ArrayList^>(common["selectedIds"]);
                for each (auto idObj in ids)
                {
                    settings->Common->SelectedIds->Add(Convert::ToInt32(idObj));
                }
            }
            if (common->ContainsKey("noneCards"))
            {
                auto flags = safe_cast<System::Collections::ArrayList^>(common["noneCards"]);
                if (flags->Count == settings->Common->NoneCards->Length)
                {
                    for (int i = 0; i < flags->Count; ++i)
                    {
                        settings->Common->NoneCards[i] = Convert::ToBoolean(flags[i]);
                    }
                }
            }
        }

        if (result->ContainsKey("fudaNagashi"))
        {
            auto fuda = safe_cast<Dictionary<String^, Object^>^>(result["fudaNagashi"]);
            if (fuda->ContainsKey("direction")) settings->FudaNagashi->Direction = fuda["direction"]->ToString();
            if (fuda->ContainsKey("judgeByRomaji")) settings->FudaNagashi->JudgeByRomaji = Convert::ToBoolean(fuda["judgeByRomaji"]);
            if (fuda->ContainsKey("changing")) settings->FudaNagashi->Changing = Convert::ToBoolean(fuda["changing"]);
            if (fuda->ContainsKey("autoAdvance")) settings->FudaNagashi->AutoAdvance = Convert::ToBoolean(fuda["autoAdvance"]);
            if (fuda->ContainsKey("waitMs")) settings->FudaNagashi->WaitMs = Convert::ToInt32(fuda["waitMs"]);
            if (fuda->ContainsKey("count")) settings->FudaNagashi->Count = Convert::ToInt32(fuda["count"]);
        }

        return settings;
    }
}

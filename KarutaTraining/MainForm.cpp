#include "MainForm.h"

using namespace System;
using namespace System::Collections::Generic;
using namespace System::Drawing;
using namespace System::IO;
using namespace System::Windows::Forms;

namespace KarutaTraining {
    MainForm::MainForm()
    {
        rng = gcnew Random();
        remaining = gcnew List<CardItem^>();
        reads = gcnew List<int>();
        history = gcnew Dictionary<int, ReadHistory^>();
        imageCache = gcnew Dictionary<String^, Image^>();
        awaitingNext = false;
        advanced = false;
        listModeSyllable = true;

        InitializeUi();
        LoadData();
        ResetAll();
    }

    void MainForm::InitializeUi()
    {
        Text = L"競技かるた 札流し(決まり字変化)";
        Width = 1100;
        Height = 720;
        StartPosition = FormStartPosition::CenterScreen;

        auto layout = gcnew TableLayoutPanel();
        layout->Dock = DockStyle::Fill;
        layout->ColumnCount = 2;
        layout->ColumnStyles->Add(gcnew ColumnStyle(SizeType::Percent, 60));
        layout->ColumnStyles->Add(gcnew ColumnStyle(SizeType::Percent, 40));
        Controls->Add(layout);

        auto leftPanel = gcnew Panel();
        leftPanel->Dock = DockStyle::Fill;
        layout->Controls->Add(leftPanel, 0, 0);

        auto rightPanel = gcnew Panel();
        rightPanel->Dock = DockStyle::Fill;
        layout->Controls->Add(rightPanel, 1, 0);

        titleLabel = gcnew Label();
        titleLabel->Text = L"競技かるた 札流し(決まり字変化)";
        titleLabel->Font = gcnew Drawing::Font(L"Meiryo", 14, FontStyle::Bold);
        titleLabel->AutoSize = true;
        titleLabel->Location = Point(12, 12);
        leftPanel->Controls->Add(titleLabel);

        statusLabel = gcnew Label();
        statusLabel->Text = L"準備完了";
        statusLabel->AutoSize = true;
        statusLabel->Location = Point(12, 44);
        leftPanel->Controls->Add(statusLabel);

        progressLabel = gcnew Label();
        progressLabel->Text = L"0 / 100";
        progressLabel->AutoSize = true;
        progressLabel->Location = Point(12, 70);
        leftPanel->Controls->Add(progressLabel);

        progressBar = gcnew ProgressBar();
        progressBar->Location = Point(12, 92);
        progressBar->Width = 520;
        leftPanel->Controls->Add(progressBar);

        cardImage = gcnew PictureBox();
        cardImage->Location = Point(12, 130);
        cardImage->Size = Drawing::Size(520, 360);
        cardImage->SizeMode = PictureBoxSizeMode::Zoom;
        leftPanel->Controls->Add(cardImage);

        answerInput = gcnew TextBox();
        answerInput->Location = Point(12, 510);
        answerInput->Width = 360;
        answerInput->KeyDown += gcnew KeyEventHandler(this, &MainForm::OnAnswerKeyDown);
        leftPanel->Controls->Add(answerInput);

        answerButton = gcnew Button();
        answerButton->Text = L"答える";
        answerButton->Location = Point(380, 508);
        answerButton->Click += gcnew EventHandler(this, &MainForm::SubmitAnswer);
        leftPanel->Controls->Add(answerButton);

        skipButton = gcnew Button();
        skipButton->Text = L"スキップ";
        skipButton->Location = Point(460, 508);
        skipButton->Click += gcnew EventHandler(this, &MainForm::SkipQuestion);
        leftPanel->Controls->Add(skipButton);

        resultLabel = gcnew Label();
        resultLabel->AutoSize = true;
        resultLabel->Location = Point(12, 540);
        leftPanel->Controls->Add(resultLabel);

        remainLabel = gcnew Label();
        remainLabel->AutoSize = true;
        remainLabel->Location = Point(12, 570);
        leftPanel->Controls->Add(remainLabel);

        resetButton = gcnew Button();
        resetButton->Text = L"リセット";
        resetButton->Location = Point(12, 600);
        resetButton->Click += gcnew EventHandler(this, &MainForm::ResetAll);
        leftPanel->Controls->Add(resetButton);

        toggleListButton = gcnew Button();
        toggleListButton->Text = L"並び替え";
        toggleListButton->Location = Point(12, 12);
        toggleListButton->Click += gcnew EventHandler([this](Object^, EventArgs^) {
            listModeSyllable = !listModeSyllable;
            RenderList();
        });
        rightPanel->Controls->Add(toggleListButton);

        listView = gcnew ListView();
        listView->Location = Point(12, 44);
        listView->View = View::Details;
        listView->FullRowSelect = true;
        listView->Columns->Add(L"札", 90);
        listView->Columns->Add(L"決まり字", 120);
        listView->Columns->Add(L"状態", 120);
        listView->Width = 380;
        listView->Height = 600;
        rightPanel->Controls->Add(listView);

        autoTimer = gcnew Timer();
        autoTimer->Tick += gcnew EventHandler(this, &MainForm::AdvanceToNext);
    }

    void MainForm::LoadData()
    {
        String^ baseDir = AppDomain::CurrentDomain->BaseDirectory;
        cardImages = DataStore::LoadCardImages(baseDir);
        kimariji = DataStore::LoadKimarijiData(baseDir);
        settings = DataStore::LoadSettings(baseDir);
    }

    List<int>^ MainForm::DecideAllowedIds()
    {
        auto allowed = gcnew List<int>();
        if (settings->Common->AllOrPart && settings->Common->SelectedIds->Count > 0)
        {
            for each (int id in settings->Common->SelectedIds)
            {
                allowed->Add(id);
            }
        }
        else
        {
            for each (auto item in kimariji->Items)
            {
                allowed->Add(item->Id);
            }
        }
        return allowed;
    }

    List<CardItem^>^ MainForm::SessionCards()
    {
        auto allowed = gcnew HashSet<int>(DecideAllowedIds());
        auto list = gcnew List<CardItem^>();
        for each (auto item in kimariji->Items)
        {
            if (allowed->Contains(item->Id))
            {
                list->Add(item);
            }
        }
        return list;
    }

    void MainForm::ResetAll()
    {
        remaining->Clear();
        remaining->AddRange(SessionCards());
        reads->Clear();
        reads->AddRange(DecideAllowedIds());
        KarutaUtils::Shuffle(reads, rng);
        idx = 0;
        awaitingNext = false;
        advanced = false;
        history->Clear();

        autoTimer->Stop();
        answerInput->Enabled = true;
        statusLabel->Text = L"準備完了";
        skipButton->Text = L"スキップ";

        int maxCount = Math::Min(settings->FudaNagashi->Count, reads->Count);
        settings->FudaNagashi->Count = maxCount;

        UpdateProgress();
        ShowQuestion();
    }

    void MainForm::ShowQuestion()
    {
        advanced = false;
        if (autoTimer->Enabled) autoTimer->Stop();
        skipButton->Text = L"スキップ";

        if (idx >= settings->FudaNagashi->Count)
        {
            statusLabel->Text = L"完了";
            resultLabel->Text = L"お疲れさまでした！ 全問終了です。";
            answerInput->Enabled = false;
            cardImage->Image = nullptr;
            UpdateProgress();
            RenderList();
            return;
        }

        statusLabel->Text = L"出題中";
        resultLabel->Text = L"";
        answerInput->Text = L"";
        answerInput->Focus();

        UpdateProgress();
        UpdateImageForId(CurrentId());
        RenderList();
    }

    void MainForm::AdvanceToNext(Object^, EventArgs^)
    {
        if (advanced) return;
        advanced = true;
        if (autoTimer->Enabled) autoTimer->Stop();
        if (idx >= reads->Count) return;

        int current = CurrentId();
        int removeIndex = remaining->FindIndex(gcnew Predicate<CardItem^>([current](CardItem^ item) { return item->Id == current; }));
        if (removeIndex >= 0) remaining->RemoveAt(removeIndex);

        idx++;
        answerInput->Enabled = true;
        awaitingNext = false;
        skipButton->Text = L"スキップ";
        ShowQuestion();
    }

    void MainForm::OnAnswerKeyDown(Object^, KeyEventArgs^ e)
    {
        if (e->KeyCode == Keys::Enter)
        {
            SubmitAnswer(sender, EventArgs::Empty);
            e->Handled = true;
            e->SuppressKeyPress = true;
        }
    }

    void MainForm::SubmitAnswer(Object^, EventArgs^)
    {
        if (idx >= reads->Count) return;
        if (!answerInput->Enabled) return;

        String^ reading = CurrentReading();
        if (String::IsNullOrEmpty(reading))
        {
            resultLabel->Text = L"データ不整合：このIDの札が見つかりません";
            return;
        }

        auto remainingIds = gcnew List<int>();
        for each (auto item in remaining) remainingIds->Add(item->Id);

        String^ expected = KarutaUtils::ComputeExpectedPrefix(CurrentId(), kimariji->Items, remainingIds);
        if (String::IsNullOrEmpty(expected))
        {
            resultLabel->Text = L"データ不整合：決まり字が取得できません";
            return;
        }

        String^ raw = answerInput->Text->Trim();
        bool hasKana = KarutaUtils::HasHiragana(raw);
        bool hasAlpha = KarutaUtils::HasAlphabet(raw);
        String^ inputKana = nullptr;

        if (hasKana && hasAlpha)
        {
            resultLabel->Text = L"NG：かな＋ローマ字の混在は不可";
            statusLabel->Text = L"判定：不正解";
        }
        else if (settings->FudaNagashi->JudgeByRomaji && hasAlpha && !hasKana)
        {
            inputKana = KarutaUtils::RomajiToHiraganaStrict(raw, kimariji->RomajiVowels, kimariji->RomajiConsonant);
            if (inputKana == nullptr)
            {
                resultLabel->Text = L"NG：ローマ字表記が仕様外";
                statusLabel->Text = L"判定：不正解";
            }
        }
        else if (!hasAlpha && hasKana)
        {
            inputKana = raw;
        }
        else
        {
            resultLabel->Text = L"NG：入力形式が不正";
            statusLabel->Text = L"判定：不正解";
        }

        bool ok = false;
        if (inputKana != nullptr)
        {
            ok = String::Equals(inputKana, expected);
            if (ok)
            {
                resultLabel->Text = L"OK";
                statusLabel->Text = L"判定：正解";
            }
            else
            {
                resultLabel->Text = String::Format(L"NG：正解は {0}", expected);
                statusLabel->Text = L"判定：不正解";
            }
        }

        auto record = gcnew ReadHistory();
        record->ChangedAtRead = !String::Equals(expected, reading);
        record->Correct = ok;
        history[CurrentId()] = record;

        answerInput->Enabled = false;

        if (settings->FudaNagashi->AutoAdvance && settings->FudaNagashi->WaitMs > 0)
        {
            autoTimer->Interval = settings->FudaNagashi->WaitMs;
            autoTimer->Start();
        }
        else
        {
            awaitingNext = true;
            skipButton->Text = L"次へ";
        }
    }

    void MainForm::SkipQuestion(Object^, EventArgs^)
    {
        if (idx >= reads->Count) return;
        int id = CurrentId();
        if (history->ContainsKey(id))
        {
            AdvanceToNext(nullptr, EventArgs::Empty);
            return;
        }

        String^ reading = CurrentReading();
        String^ expected = ExpectedPrefix(reading);
        auto record = gcnew ReadHistory();
        record->ChangedAtRead = !String::Equals(expected, reading);
        record->Correct = false;
        history[id] = record;
        AdvanceToNext(nullptr, EventArgs::Empty);
    }

    void MainForm::UpdateProgress()
    {
        progressLabel->Text = String::Format(L"{0} / {1}", idx, settings->FudaNagashi->Count);
        progressBar->Maximum = settings->FudaNagashi->Count;
        progressBar->Value = Math::Min(idx, settings->FudaNagashi->Count);
        remainLabel->Text = String::Format(L"残り札：{0} 枚", remaining->Count);
    }

    void MainForm::RenderList()
    {
        listView->BeginUpdate();
        listView->Items->Clear();

        List<CardItem^>^ items = gcnew List<CardItem^>();
        if (listModeSyllable)
        {
            items->AddRange(SessionCards());
        }
        else
        {
            for (int i = 0; i < Math::Min(idx, reads->Count); ++i)
            {
                int id = reads[i];
                for each (auto item in kimariji->Items)
                {
                    if (item->Id == id) { items->Add(item); break; }
                }
            }
        }

        auto remainingIds = gcnew HashSet<int>();
        for each (auto item in remaining) remainingIds->Add(item->Id);

        for each (auto item in items)
        {
            String^ status = L"";
            if (remainingIds->Contains(item->Id))
            {
                String^ expected = ExpectedPrefix(item->Reading);
                status = String::Equals(expected, item->Reading) ? L"未読・初期" : L"未読・変化中";
            }
            else if (history->ContainsKey(item->Id))
            {
                auto record = history[item->Id];
                status = String::Format(L"{0}・{1}", record->Correct ? L"正解" : L"誤答", record->ChangedAtRead ? L"変化" : L"初期");
            }
            else
            {
                status = L"既読・不明";
            }

            String^ idStr = item->Id.ToString(L"000");
            auto row = gcnew ListViewItem(String::Format(L"#{0}", idStr));
            row->SubItems->Add(item->Reading);
            row->SubItems->Add(status);
            listView->Items->Add(row);
        }

        listView->EndUpdate();
    }

    void MainForm::UpdateImageForId(int id)
    {
        String^ token = id.ToString();
        Image^ img = GetCardImage(token);
        bool upsideDown = false;
        if (settings->FudaNagashi->Direction == "reverse") upsideDown = true;
        if (settings->FudaNagashi->Direction == "random") upsideDown = rng->NextDouble() < 0.5;
        ApplyRotation(img, upsideDown);
    }

    Image^ MainForm::GetCardImage(String^ token)
    {
        if (imageCache->ContainsKey(token)) return imageCache[token];
        if (!cardImages->ContainsKey(token)) return nullptr;

        String^ data = cardImages[token];
        int commaIndex = data->IndexOf(',');
        if (commaIndex < 0) return nullptr;
        String^ base64 = data->Substring(commaIndex + 1);
        array<Byte>^ bytes = Convert::FromBase64String(base64);
        auto stream = gcnew MemoryStream(bytes);
        Image^ img = Image::FromStream(stream);
        imageCache[token] = img;
        return img;
    }

    void MainForm::ApplyRotation(Image^ source, bool upsideDown)
    {
        if (source == nullptr)
        {
            cardImage->Image = nullptr;
            return;
        }
        Image^ display = safe_cast<Image^>(source->Clone());
        if (upsideDown)
        {
            display->RotateFlip(RotateFlipType::Rotate180FlipNone);
        }
        cardImage->Image = display;
    }

    String^ MainForm::ExpectedPrefix(String^ reading)
    {
        int maxLcp = 0;
        for each (auto item in remaining)
        {
            if (item->Reading == reading) continue;
            int l = KarutaUtils::LcpChars(reading, item->Reading);
            if (l > maxLcp) maxLcp = l;
        }
        int need = Math::Min(KarutaUtils::ToChars(reading)->Count, maxLcp + 1);
        return KarutaUtils::PrefixChars(reading, need);
    }

    String^ MainForm::CurrentReading()
    {
        int id = CurrentId();
        for each (auto item in kimariji->Items)
        {
            if (item->Id == id) return item->Reading;
        }
        return String::Empty;
    }

    int MainForm::CurrentId()
    {
        return reads[idx];
    }
}

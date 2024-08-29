RSpec.describe "Placeholder", system: true do
  let(:theme) { Fabricate(:theme) }
  let!(:component) { upload_theme_component(parent_theme_id: theme.id) }

  fab!(:current_user) { Fabricate(:user) }

  let(:topic_page) { PageObjects::Pages::Topic.new }

  before do
    theme.set_default!
    sign_in(current_user)
  end

  context "when using default attribute" do
    fab!(:post) do
      Fabricate(
        :post,
        raw: "[wrap=placeholder key=\"TEST\" default=\"foo\"][/wrap]\n\nBEFORE =TEST= AFTER",
      )
    end

    it "replaces keys on load" do
      topic_page.visit_topic(post.topic)

      expect(page).to have_content("BEFORE foo AFTER")
    end
  end

  context "when using multiple placeholders" do
    fab!(:post) do
      Fabricate(
        :post,
        raw:
          "[wrap=placeholder key=\"TEST1\"][/wrap]\n\n[wrap=placeholder key=\"TEST2\"][/wrap]\n\nBEFORE =TEST1= =TEST2= AFTER",
      )
    end

    it "replaces each of them" do
      topic_page.visit_topic(post.topic)

      page.find('.discourse-placeholder-value[data-key="TEST1"]').fill_in(with: "foo")

      expect(page).to have_content("BEFORE foo =TEST2= AFTER")

      page.find('.discourse-placeholder-value[data-key="TEST2"]').fill_in(with: "bar")

      expect(page).to have_content("BEFORE foo bar AFTER")
    end
  end
end

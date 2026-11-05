import { fireEvent, render, screen } from "@testing-library/react-native";
import { Modal } from "react-native";
import PeopleScreen from "@/app/(tabs)/people";

const mockSelect = jest.fn();

jest.mock("@/lib/controllers", () => {
  const { EMPTY_PERSON_FORM_VALUES, RELATIONSHIP_OPTIONS } = jest.requireActual("@/lib/models");
  return {
    usePeopleController: () => ({
      activeGroup: "all",
      activeGroupLabel: "People",
      editorOpen: true,
      editorTitle: "Edit Person",
      filteredPeople: [],
      form: EMPTY_PERSON_FORM_VALUES,
      groupCounts: {},
      isEditing: true,
      relationshipPickerOpen: true,
      relationships: RELATIONSHIP_OPTIONS,
      search: "",
      setRelationshipPickerOpen: jest.fn(),
      triggerRelationshipSelect: mockSelect,
    }),
  };
});

describe("PeopleScreen relationship picker", () => {
  it("is presented from the editor sheet, since iOS cannot present two sibling sheets", () => {
    render(<PeopleScreen />);

    const [editor, ...rest] = screen.UNSAFE_getAllByType(Modal);
    expect(rest).toHaveLength(1);
    expect(editor.findAllByType(Modal)).toContain(rest[0]);
  });

  it("selects a relationship", () => {
    render(<PeopleScreen />);

    fireEvent.press(screen.getByText("Sibling"));

    expect(mockSelect).toHaveBeenCalledWith("sibling");
  });
});
